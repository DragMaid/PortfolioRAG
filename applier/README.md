# applier

Finds postings on job boards, measures each against the portfolio with the `rag` job-fit
pipeline, and applies to the ones that clear the bar — cover letter written from the same
portfolio, employer questions answered from facts you wrote down, submitted through the
board's own form. It runs on your machine, in browsers you are signed in to.

There are two ways to run it. `applier serve` opens a page and runs it with you watching,
which is where to start — and where setting it up happens, by answering the questions a real
form asked rather than by writing a config. `applier run` does the whole thing from the
command line, deciding everything itself, out of the same file.

```
  ┌───────────── applier (your machine) ─────────────┐
  │                                                   │
  │  page (React) ── controller ──────────────────────┼─▶ you: pick · check · send
  │        │           one thread per board           │
  │        ▼                                          │
  │  board adapter ── camoufox, board profile ────────┼──▶ sg.jobstreet.com
  │   search · fetch · apply    a tab per hand-off    │
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

```sh
cd applier
uv sync
uv run camoufox fetch                           # once, if rag has not already
uv run applier serve                            # then open http://127.0.0.1:8765
```

That is the whole of it. There is nothing to write and nothing to export first: `applier
serve` writes a config if there is none and opens on a setup run, which does the rest —
signing in to the board, one **mock application**, the questions that came off it, and the
portfolio token, which you paste into the page.

Assessing a posting does need the portfolio API, which it asks at
`https://api.blograg.pbh-dev.tech` unless *Settings → Model & access* points it somewhere
else — at one you are running yourself, say. Nothing before that step needs it, including
all of setup bar its last.

### The setup run

Nobody can write down in advance the facts an employer will ask them for, so this does not
ask them to.

1. **Sign in to the board.** A window opens; you sign in once and the profile is kept.
2. **One mock application.** Paste a posting you are happy to have opened. Its form is walked
   as far as its questions and abandoned there — nothing answered, nothing continued, nothing
   sent — and the tab closes. The posting is not recorded, so it is still yours to apply to
   properly later.
3. **Answer what it found.** That employer's own questions, word for word, plus the handful
   nearly every board asks. Each answer becomes a fact, named after what it states rather
   than how it was asked: *"Do you have a valid driving licence?"* is kept as
   `Valid driving licence`. The resumes already on your board profile are read off the same
   form, so choosing one is picking from a list rather than typing a filename.
4. **Searches.** Keywords and a location, or a search URL you have refined in the board's own
   interface. *Preview* shows the first page before you commit to anything.

It needs no portfolio API, no rag worker and no model — which matters, because otherwise
getting four things running would come before finding out whether any of this suits you.

**It does not finish the job, and says so.** One form asks three or four things; employers
keep asking new ones. That is what `run.answers: missing` is for — the run stops, asks, and
keeps what you type. Setup gets you to a working profile; the runs themselves keep it working.

### Credentials

| | Where it lives | Why |
|---|---|---|
| **Portfolio token** (`pfl_…`) | Pasted into the page; kept in `.applier/secrets.yaml`, mode 0600 | Retrieval runs under it, so nothing can be assessed without one — and demanding it in the environment meant the controller could not start, and so could not show the box that asks for it. Exporting `APPLIER_PORTFOLIO_TOKEN` still works, and is what `applier run` reads when nothing was pasted. A pasted one wins, so replacing an expired export actually takes effect. |
| **Provider key** (anthropic, openai, …) | The environment only | Worth real money if it leaks, and nothing here needs it before it can start. The page names the variable and says whether it is set; the key never reaches the page, the config or the disk. |
| **Chat site sign-in** (the `web` provider) | A browser profile | *Settings → Model & access* opens a window to sign in, or `uv run --project ../rag python -m rag.webchat login gemini`. |

Neither credential ever goes into `applier.yaml`. That file is the one you would hand
somebody to show how this is set up.

## Using it from the command line

The page is where to start, and everything below reads the same `applier.yaml` it writes —
so a run tuned on the page behaves the same way here.

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
window you can see, and the table's *Show tab* brings the page a row was filled in on to the
front — so a row you are reading and its form stay connected.

A form only gets a tab of its own when it is going to be **left** for you: one tab per
hand-off, not one per posting. Everything a run does for itself happens in the window's one
working tab, and anything the board opens behind its own back is closed between commands.

Three settings decide how much happens without you, and all three live in `applier.yaml`
under `run:` — so what the page's toggles say and what `applier run` would do tomorrow are
the same thing read twice.

| Setting | What turning it down means |
|---|---|
| **Pick postings itself** | Off: everything that clears the policy waits in the table until you press *Apply* on its row. |
| **Submit applications itself** | Off: each form is filled to its review page and left open in a tab. You read it and press submit yourself. |
| **When to ask about an answer** | `never` — a required question no fact answers skips the posting. `missing` *(default)* — the run stops and asks, and keeps what you type. `always` — every question and its answer, with the fact behind it, before the form is filled. |

The first two are independent: pick by hand and let it submit, or let it pick and send
nothing without you. With sending turned off the run keeps going while you work through the
tabs, pausing at five open hand-offs (configurable) rather than burying you in them.

`missing` is the one that makes a thin profile workable. A fact you type into that pause is
written into the config immediately, so the next posting that asks the same thing — and the
next run, and the command line tomorrow — is answered without stopping.

**A hand-off settles itself.** The tab you were given is watched: submit it there and the
row becomes `applied` without you pressing anything. The row's buttons are for when that
misses — *I sent it*, or discard. A tab you close without the board confirming anything is
recorded `unconfirmed` and never retried, because nobody can say whether it went.

The page also carries the rest of what you need while deciding: the full job-fit report and
the cover letter behind every row, the whole ledger with the unanswered-question digest, and
a box to paste a posting into and get a report or a letter for it — `rag-local`'s two
pipelines, mounted under `/api/rag` and run through the same signed-in chat session.

### Settings

Everything the config holds is editable on the page: your details and the two notes boxes,
the facts, the searches, which model answers, where the portfolio API is, and the file itself
as text. Structured
editors are the main path; the raw view is the escape hatch, checked against the same loader
the server started with and refused whole if it would not load — so nothing you type there
can leave the tool unable to start.

Saving goes through a round-trip loader, so a config you hand-edited still has its comments
afterwards. The one thing that stays out is a provider key: the page names the environment
variable it should come from and reports whether that variable is set. The key itself never
reaches the page, the config, or the disk.

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
- **The controller, whole.** Picking, the table, hand-offs, tabs, the answer review and the
  setup run are all in terms of `JobBoard`, so a new adapter gets every one of them without
  knowing they exist. Three things make it work, all on `ApplyContext`:
  `hand_off` stops at the review page and leaves it exactly as it is
  (`Submission(handed_off=True)`); `probe` stops one step earlier and reports the questions
  and the profile's resumes instead of answering anything (`Submission(probe=Probe(...))`),
  which is the whole of the setup run; and `submitted()` reads whether the page in front of
  it shows a sent application, which is what lets a tab you submitted yourself settle its
  own row.
- **Tabs.** An adapter never opens one. The controller runs `apply` inside
  `browser.on(<the posting>)` when the form is to be handed over and `browser.on(None)` when
  it is not, and `browser.page` — which is all an adapter reaches for — points at the right
  one for the whole flow either way.

For LinkedIn Easy Apply, the adapter's `apply` walks the modal's steps and calls
`read_fields` on the modal for each one; `hand_off` means stopping on the modal's review
step instead of clicking through it, `probe` means stopping on its first question step and
returning what `read_fields` found, and `submitted` looks for its "Application sent" panel.
Search and posting pages are the only LinkedIn-specific code.

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
                              # setup, server — all with fakes: no browser, no model, no board
uv run pytest -m browser      # the form reader and filler, in camoufox, on a local page
uv run ruff check .
cd web && npm run lint        # the page's types
```

`tests/test_controller.py` drives the whole state machine against a fake board and a fake
browser. What it pins down is the bookkeeping either side of a hand-off, because that is
where a double application would come from: handed over is on record *before* you can touch
it, a tab you closed without a confirmation is `unconfirmed` rather than applied, and the
hand-off cap really does hold the queue back.

`tests/test_setup.py` covers the other half — arriving at a working profile without writing
a config, and the config surviving being written. One of those tests exists because of a
genuinely nasty bug: *"Do you have a driving licence?"* is answered **No**, and YAML reads a
bare `No` as the boolean false, so the fact came back as `False` and the config stopped
loading altogether. Anything whose own spelling would not survive the round trip is now
written quoted.
