# applier

Finds postings on job boards, measures each against the portfolio with the `rag` job-fit
pipeline, and applies to the ones that clear the bar — cover letter written from the same
portfolio, employer questions answered from facts you wrote down, submitted through the
board's own form. It runs on your machine, in browsers you are signed in to.

There are two ways to run it. `applier serve` opens a page and runs it with you watching,
which is where to start; `applier run` does the whole thing from the command line, deciding
everything itself.

```
  ┌───────────── applier (your machine) ─────────────┐
  │                                                   │
  │  page (React) ── controller ──────────────────────┼─▶ you: pick · check · send
  │        │           one thread per board           │
  │        ▼                                          │
  │  board adapter ── camoufox, board profile ────────┼──▶ sg.jobstreet.com
  │   search · fetch · apply       tabs, one per job  │
  │        │                                          │
  │        ▼                                          │
  │  pipeline ── ledger.sqlite                        │     ┌──────────────┐
  │        │                                          │     │ portfolio API│
  │        ▼                                          │     │ + rag worker │
  │  rag JobFitPipeline / CoverLetterPipeline ────────┼────▶│  retrieval   │
  │        │                                          │     └──────────────┘
  │        ▼                                          │
  │  model thread ── chat site (or an API provider) ──┼──▶ gemini / claude / chatgpt
  └───────────────────────────────────────────────────┘
```

## The run

```
search    (board)  listings for each configured search, page by page
triage    (code)   skip what the ledger has settled, titles/companies the policy excludes,
                   link-outs, expired postings
assess    (rag)    the six-stage job-fit pipeline; verdict and score are computed in code
decide    (code)   the policy's thresholds: min verdict, min score, missing essentials
write     (rag)    the cover-letter pipeline, citing the same portfolio
answer    (LLM)    employer questions, from candidate.facts only; checked in code
submit    (board)  documents → questions → profile → review → submit
```

Everything that decides is code. The model reads postings, judges evidence and writes, the
same way it does for the portfolio's own job-fit page. What it produces is then checked
before it can do anything: the verdict against thresholds, and every employer-question
answer against the options on the form and against a fact you actually wrote. **An answer
that does not point at one of your facts is discarded, and a required question left
without an answer skips the posting.** Skipping an application costs nothing. A false
answer to an employer does.

## Setup

Needs the portfolio API and the rag worker running (retrieval runs there, under your
token), exactly as for `rag-local`.

```sh
cd applier
uv sync
uv run camoufox fetch                           # once, if rag has not already
cp applier.example.yaml applier.yaml            # then fill it in: searches, facts, resume
export APPLIER_PORTFOLIO_TOKEN=pfl_...          # studio → access, write scope

uv run --project ../rag python -m rag.webchat login gemini   # the model's chat site
uv run applier login jobstreet                               # the board; profile is kept
```

## Using it

```sh
uv run applier run --dry-run --limit 2          # fill up to the review page, submit nothing
uv run applier run                              # the real thing, up to policy.max_applications
uv run applier apply https://sg.jobstreet.com/job/94734876 --dry-run
uv run applier status                           # what happened to everything seen
uv run applier questions                        # questions your facts could not answer
uv run applier run --retry-skipped              # after adding facts for them
```

Start with dry runs. A dry run captures the review page (screenshot and HTML under
`.applier/captures/`), so you can read exactly what would have been sent. Add
`--capture-steps` to save every step.

## The controller

```sh
uv run applier serve            # then open http://127.0.0.1:8765
```

The same run, with the two decisions that matter handed back to you. Boards open in a
window you can see, each posting gets a tab of its own, and the table's *Show tab* brings
any of them to the front — so a row you are reading and the page it was filled in on stay
connected.

Three toggles decide how much happens without you:

| Toggle | Off |
|---|---|
| **Pick postings itself** | Everything that clears the policy waits in the table until you press *Apply* on its row. |
| **Submit applications itself** | Each form is filled to its review page and left open in a tab. You read it and press submit yourself. |
| **Check employer answers first** | — (off by default) On, every question and the answer it would give is shown, with the fact behind it, before the form is filled. |

Both halves can be turned down independently: pick by hand and let it submit, or let it
pick and send nothing without you. With sending turned off the run keeps going while you
work through the tabs, pausing at five open hand-offs (configurable) rather than burying
you in them.

**A hand-off settles itself.** The tab you were given is watched: submit it there and the
row becomes `applied` without you pressing anything. The row's buttons are for when that
misses — *I sent it*, or discard. A tab you close without the board confirming anything is
recorded `unconfirmed` and never retried, because nobody can say whether it went.

The page also carries the rest of what you need while deciding: the full job-fit report and
the cover letter behind every row, the whole ledger with the unanswered-question digest, and
a box to paste a posting into and get a report or a letter for it — `rag-local`'s two
pipelines, mounted under `/api/rag` and run through the same signed-in chat session.

`applier.yaml` is read at startup and **never written back**. The panel's thresholds,
searches and facts are this session's; the page shows you what to paste to keep them.

### Building the page

The page is a Vite + React build committed under `web/dist`, so running the tool needs no
Node. Changing it does:

```sh
cd web
npm ci
npm run dev          # http://127.0.0.1:5174, proxying /api to applier serve
npm run build        # rebuild web/dist — commit it with your change
```

## Safety

- **The ledger** (`.applier/ledger.sqlite`) is written after every posting. A posting with
  a settled status (`applied`, `unfit`, `excluded`, `external`, `unavailable`,
  `unconfirmed`, `submitting`, `awaiting_human`, `skipped`) is never opened again, so runs
  are safe to repeat and a run that dies halfway resumes where it stopped. `pending` — a
  shortlist the controller built and you never picked from — is not settled, so it comes
  back the next time you open the page.
- **Never twice.** A real submission is recorded as `submitting` *before* the click. If the
  process dies between the click and the next write, the posting stays `submitting` and is
  never retried. The same goes for a submit the board never confirms (`unconfirmed`), and
  for an application handed to you: it is written `awaiting_human` before the tab is yours,
  so whatever you do with it — send it, close it, walk away — nothing reopens it. Check
  those by hand in JobStreet's *My activity*.
- **Limits per run:** `max_applications` submitted and `max_assessments` assessed, with a
  random `delay_seconds` pause between applications.
- **Fatal errors stop the run:** signed out, a bot check that does not clear, or the
  portfolio API unreachable. Every posting after one of those would fail the same way.

## Adding a board

A board is an adapter in `src/applier/boards/`, implementing `JobBoard`
(`boards/base.py`), plus one line in `BOARDS`. It gets an open browser and does five
things: `search`, `fetch`, `apply`, `ensure_signed_in` and `submitted`. It never sees the
policy, the model, the ledger or the controller.

What a new board gets for free:

- **Reading forms.** `forms.read_fields(root)` reads every question under a locator,
  whatever controls draw it (text, select, radio groups, checkboxes, single yes/no
  checkboxes). It tags each control, and `forms.fill` writes an answer back through that
  tag. An adapter only has to point at the form.
- **Answering.** `context.answerer.answer(handles, role=...)` returns checked answers, or
  raises `UnanswerableError`, which the pipeline records as `needs_input`.
- **Failure capture.** `browser.fail(error)` saves the page onto the error before raising.
- **The controller, whole.** Picking, the table, hand-offs, tabs and the answer review are
  all in terms of `JobBoard`, so a new adapter gets every one of them without knowing they
  exist. Two things make it work: `apply` honours `context.hand_off` by stopping at its
  review page and leaving it exactly as it is (`Submission(handed_off=True)`), and
  `submitted()` reads whether the page in front of it shows a sent application — that is
  what lets a tab you submitted yourself settle its own row.
- **Tabs.** An adapter never opens one. The controller runs `apply` inside
  `browser.on(<the posting>)`, and `browser.page` — which is all an adapter reaches for —
  points at that tab for the whole flow.

For LinkedIn Easy Apply, the adapter's `apply` walks the modal's steps and calls
`read_fields` on the modal for each one; `hand_off` means stopping on the modal's review
step instead of clicking through it, and `submitted` looks for its "Application sent"
panel. Search and posting pages are the only LinkedIn-specific code.

## JobStreet notes

- Search and posting pages are matched on SEEK's `data-automation` hooks, checked against
  sg.jobstreet.com. Link-out postings are read from the page's embedded server state and
  skipped.
- The apply flow sits behind a sign-in and is matched by accessible names and visible
  text ("Write a cover letter", "Continue", "Submit application"). If a step stops being
  recognised, the error says which one and where its page was captured. Selectors live in
  `boards/jobstreet/selectors.py`.
- Camoufox evaluates scripts in an isolated world, so page globals like
  `window.SEEK_APOLLO_DATA` are read from the page source, not from JavaScript.

## Tests

```sh
uv run pytest                 # unit: config, answer checking, ledger, pipeline, controller,
                              # server — all with fakes: no browser, no model, no board
uv run pytest -m browser      # the form reader and filler, in camoufox, on a local page
uv run ruff check .
cd web && npm run lint        # the page's types
```

`tests/test_controller.py` drives the whole state machine against a fake board and a fake
browser. What it pins down is the bookkeeping either side of a hand-off, because that is
where a double application would come from: handed over is on record *before* you can touch
it, a tab you closed without a confirmation is `unconfirmed` rather than applied, and the
hand-off cap really does hold the queue back.
