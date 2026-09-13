# rag

Retrieval over an author's portfolio, and the job-fit analysis built on it.

A visitor pastes a job description at somebody's portfolio; this works out which of the
posting's requirements the published work actually evidences, and cites the passage behind
every claim it makes.

The service has exactly one job: drain the `RagJobs` table the API writes to. It exposes no
port and nothing talks to it.

```
                    ┌──────────────┐
   browser ────────▶│  ASP.NET API │──── INSERT RagJobs ──┐
                    └──────────────┘                      │
                            ▲                             ▼
                            │                     ┌───────────────┐
                            └── poll job status ──│   Postgres    │
                                                  │  + pgvector   │
                                                  └───────────────┘
                                                     ▲         │
                                          claim job  │         │ NOTIFY
                                        write result │         ▼
                                                  ┌───────────────┐
                                                  │  rag worker   │──▶ provider
                                                  └───────────────┘    (author's key)
```

## Why it looks like this

**The queue is a Postgres table.** Workers claim rows with `SELECT … FOR UPDATE SKIP
LOCKED` and are woken by `LISTEN/NOTIFY`. That buys the two things a broker would have —
at-least-once delivery and no thundering herd — without a second piece of infrastructure,
and with one property a broker could not give: the job, its result, its cost and its audit
trail are one row in the same database as the data it was computed from. NOTIFY is an
optimisation over polling, never the delivery mechanism, so a lost notification costs
latency rather than a job.

**Embeddings run locally.** `bge-small-en-v1.5` through fastembed's ONNX runtime: 384
dimensions, no key, no per-call cost, no torch in the image. That is what makes the index
design work — every run re-cuts the whole corpus and re-embeds only what changed, which
would be an awkward bill against a hosted embedding API and is free here.

**Freshness is checked at query time, not maintained by invalidation.** Every analysis calls
`indexing.ensure` first. An unchanged portfolio costs two queries and no model time, because
each passage carries a content hash. So nothing in the API has to remember to invalidate
anything when a post is edited, and there is no cache to go stale.

**Three of the six stages are code, not a model.** Retrieval, citation verification and
scoring are deterministic. That split is the design: every judgement a model makes is
checked or replaced by something reproducible before a reader sees it.

## The pipeline

```
1. extract      LLM    posting -> requirements, each with a search written for it
2. retrieve     code   requirements -> passages: dense + sparse, fused, diversified
3. assess       LLM    passages -> a status and a citation per requirement
4. verify       code   citations -> only what the passages support; the rest demoted
5. score        code   verified findings -> a number that means the same thing twice
6. narrate      LLM    verified findings -> prose that cannot outrun its evidence
```

**Stage 1 is what makes retrieval work.** A posting is two thousand words of mixed
requirements, benefits and boilerplate; embedding it whole produces a vector pointing at the
average of all of it, which retrieves the portfolio's most generically impressive passages.
Splitting it into requirements and searching for each separately is what lets the tenth
requirement be found at all.

**Stage 2 runs both halves of the search on every query.** Vector search finds "built a
scheduler for batch workloads" from "distributed job orchestration" and misses "Kubernetes"
when the passage says it once in passing; keyword search does the opposite. A posting is
full of both kinds of requirement. The two are fused with reciprocal rank fusion, which
throws the scores away and keeps only the ranks — the two scales are not comparable and any
conversion between them would need re-tuning whenever either side changed. Then MMR trades
a little relevance for variety, because the top of a fused list is otherwise the same
project four times.

**Stage 4 is the one that earns its place.** The interesting failure of a system like this
is not being wrong, it is being fluent about experience the author does not have, in public,
on the author's own site. Every claim names the passage it came from; a citation to a
passage that was never shown is dropped, a quote that is not really in its passage is
dropped, and a claim left with no evidence is demoted to "not shown" rather than quietly
kept. Rejections are counted and reported.

**Stage 5 is arithmetic, never a model.** A model asked to score a candidate out of a
hundred will produce a number that drifts between runs, clusters in the seventies, and does
not move when a requirement is demoted. A formula moves, always in the same direction, which
is the only way two runs are comparable and the only way the eval can tell an improvement
from noise.

**Stage 6 never sees the passages** — only the verified findings — so the prose physically
cannot reintroduce a claim the evidence did not survive.

## Running it

Needs a migrated database. From the repository root:

```sh
docker compose up -d db
dotnet ef database update --project backend/backend.csproj
```

Then:

```sh
cd rag
cp .env.example .env          # the encryption key must match the API's Llm:EncryptionKey
uv sync
uv run rag-worker             # drains the queue until signalled
uv run rag-worker --once      # runs whatever is queued, then exits
uv run rag-index 1 --force    # rebuild one author's index in the foreground
```

Or as part of the stack, which is what a deployment does:

```sh
docker compose up -d rag
docker compose up -d --scale rag=3    # SKIP LOCKED needs no coordination between them
```

### Configuration

Everything is `RAG_*` in the environment or `.env`; `.env.example` lists it. Two settings
are not free choices:

| Setting | Must match |
|---|---|
| `RAG_ENCRYPTION_KEY` | The API's `Llm:EncryptionKey`, exactly. It is what author provider keys were sealed with. A mismatch is not a degraded mode — it is every analysis failing to read a key. |
| `RAG_EMBEDDING_DIMENSIONS` | The width of the `RagDocuments.Embedding` column, which the migration fixed at 384. The worker refuses to start if they disagree rather than writing vectors the column will reject. |

## Tests

```sh
uv run pytest                        # unit only: no database, no network, no cost
uv run pytest -m integration         # also needs a migrated Postgres
uv run ruff check .
```

The unit suite covers the parts that are pure — chunking, fusion, MMR, scoring, citation
verification — and the C#/Python encryption interop, which is pinned against a checked-in
ciphertext produced by the .NET side. `tests/test_pipeline.py` runs the whole pipeline
against a stubbed provider, which is how the interesting cases get tested at all: a real
model will not reliably fabricate a citation on demand, and "what happens when it cites a
passage that was never shown" is precisely the behaviour that has to work.

## Evals

```sh
uv run rag-eval --retrieval-only     # free: no provider key, no network, no cost
uv run rag-eval                      # the full pipeline; asks before it spends anything
uv run rag-eval --judge              # ...and grades the prose with an LLM judge
uv run rag-eval --retrieval-only --k 3   # tighter cutoff, to see where recall breaks
```

Both halves run against a fixture portfolio (`eval/datasets/portfolio.json`) seeded into a
scratch account and deleted afterwards, so results do not depend on whatever is in somebody's
development database.

**Retrieval is scored separately and for free.** When an answer is bad, "reasoned badly
about good passages" and "reasoned perfectly about passages that did not contain the answer"
look identical from the outside and call for opposite fixes. recall@k is the ceiling on
everything downstream and the number to fix first; nDCG is the one that notices a change
that reorders without adding or losing anything, which is what tuning fusion or MMR does.

**Generation is graded by deterministic checks first.** Whether a cited passage was
retrieved, whether a quote is in it, whether every requirement came back — these need no
model, cost nothing, never drift, and catch a fabricated citation every time where a judge
would catch it most of the time. Structural failures fail the suite. The LLM judge only
grades what has no closed form — is the summary calibrated against the findings, are the
gaps stated plainly — and can only move a report between pass and warn, because a judge that
could fail a build on its own is a judge whose bad day becomes a red CI run.

`eval/datasets/golden.jsonl` asserts verdict bands and keyword sets rather than exact prose.
A generated report is not deterministic and an eval that asserted on its wording would fail
on every rerun and teach everyone to ignore it. The case worth reading is
`mobile-adversarial-weak`: it asks for iOS work the fixture portfolio does not contain,
against a portfolio full of adjacent-sounding material — embedded C, Bluetooth, low-power
devices. A system that reasons from "a strong systems engineer probably also…" fails it.

## Another provider

See `src/rag/providers/README.md`. The pipeline never imports a vendor; it asks the registry
for something satisfying `ChatProvider` and uses four methods. Adding one is an adapter, a
line in the registry, and two small edits on the API side.
