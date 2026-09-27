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
  │        ├──── /api/ext ◀───────────────────────────┼─── extension, in your Chrome:
  │        ▼                                          │    fills the manual queue's forms
  │  board adapter ── camoufox, board profile ────────┼──▶ sg.jobstreet.com
  │   search · fetch · auto-apply   one tab, healed   │
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
                   expired postings
assess    (rag)    the six-stage job-fit pipeline; verdict and score are computed in code
decide    (code)   the policy's thresholds: min verdict, min score, missing essentials
write     (rag)    the cover-letter pipeline, citing the same portfolio
route     (code)   quick apply + apply_mode auto  -> the board submits it
                   link-out, or apply_mode manual  -> the manual queue, for the extension
answer    (LLM)    employer questions: your details and remembered answers first, then
                   candidate.facts; checked in code
submit    (board)  documents → questions → profile → review → submit
```

A posting that links out to the employer's own site is **assessed like any other** —
whether it is worth applying to does not depend on whose form it is. Only who fills the form
does: the board adapter never follows a link-out, so a fit goes to the manual queue.

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
   sent. The posting is not recorded, so it is still yours to apply to properly later.
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
remembers what you answer. Setup gets you to a working profile; the runs themselves, and the
extension, keep it working.

### The browser extension

For everything you apply to by hand — the manual queue, and any other application form you
point it at — there is a Chrome extension (`extension/`). It reads a page's questions with
the same reader the board adapters use (`src/applier/js/fields.js`, shared, not copied), asks
`applier serve` for the answers, fills them in the way typing would (framework-controlled
inputs included), and attaches your resume. Whatever nothing answers is listed in its side
panel; answer it there, tick *Remember*, and the next form anywhere that asks the same
question — in the extension or during a run — is answered with it.

```sh
cd extension
npm ci && npm run build        # then chrome://extensions → Developer mode → Load unpacked → dist/
```

Paste the controller's address and the pairing key from the page's *Browser extension* card
into the extension's side panel. Then, in the table, *Open* on a row that is **yours to send**:
the page fills itself. A link-out opens on the board's posting page; press its apply button
and the employer's form, in the new tab, is filled for the same posting. *I sent it* in the
side panel records it.

Answers come from three places, cheapest first: your details (name, email, phone) for the
questions every form asks; answers you gave before, matched by question and only reused where
they still fit the form's options and limits; and then the model, which is shown your
remembered answers as facts it may cite — the same rule as on a board's form.

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

The same run, with the two decisions that matter handed back to you. The board's browser only
ever does unattended work — searching, reading postings, submitting quick-apply forms — in
**one tab**. Close that tab, or the whole window, and the next command reopens it (on the
same profile, so the sign-in survives); the posting that was cut off is tried once more and
the run carries on. Anything the board opens behind its own back is closed between commands.
Anything you apply to by hand, you open in your own browser, with the extension.

Three settings decide how much happens without you, and all three live in `applier.yaml`
under `run:` — so what the page's toggles say and what `applier run` would do tomorrow are
the same thing read twice.

| Setting | What turning it down means |
|---|---|
| **Pick postings itself** (`auto_pick`) | Off: everything that clears the policy waits in the table until you press *Apply* on its row. |
| **Who sends an application** (`apply_mode`) | `auto`: JobStreet quick-apply forms are filled and submitted by the board. `manual`: every fit goes to the manual queue, its letter written, for you to open and send with the extension. `board_modes` sets it per board. Link-outs are always manual. |
| **When to ask about an answer** (`answers`) | `never` — a required question nothing answers skips the posting. `missing` *(default)* — the run stops and asks, and remembers what you answer. `always` — every question and its answer, with the fact behind it, before the form is filled. |

The first two are independent: pick by hand and let the board submit, or let it pick and send
nothing without you. The manual queue does not count against `max_applications` — nothing in
it has been sent.

`missing` is the one that makes a thin profile workable. An answer you type into that pause
is remembered, and a fact you add there is written into the config, so the next posting that
asks the same thing — and the next run, and the command line tomorrow — is answered without
stopping. Stopping the run while a pause is open discards it; nothing has been sent.

The page also carries the rest of what you need while deciding: the full job-fit report and
the cover letter behind every row, the whole ledger with the unanswered-question digest, and
a box to paste a posting into and get a report or a letter for it — `rag-local`'s two
pipelines, mounted under `/api/rag` and run through the same signed-in chat session.

### Settings

The resume is picked, not typed: *Choose a file* uploads it to the controller, which keeps
a copy under `.applier/resumes/` and sends that with every application (and with the
extension). Or name one already on your board profile. *Include a cover letter* off sends
applications with JobStreet's "Don't include a cover letter", and writes none.

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
  a settled status (`applied`, `unfit`, `excluded`, `unavailable`, `unconfirmed`,
  `submitting`, `manual`, `skipped`) is never opened again, so runs
  are safe to repeat and a run that dies halfway resumes where it stopped. `pending` — a
  shortlist the controller built and you never picked from — is not settled, so it comes
  back the next time you open the page.
- **Never twice.** A real submission is recorded as `submitting` *before* the click. If the
  process dies between the click and the next write, the posting stays `submitting` and is
  never retried. The same goes for a submit the board never confirms (`unconfirmed`), and
  for a posting in the manual queue: it is written `manual`, and nothing automatic ever
  submits it or reopens it — only *I sent it* or *Skip* settles it. Check `unconfirmed`
  ones by hand in JobStreet's *My activity*.
- **The extension's routes want a key.** The server listens on loopback only, but any page
  open in the same browser can reach 127.0.0.1, so `/api/ext/*` — which hands out your
  answers and your resume — wants the pairing key, and sends no CORS headers.
- **Limits per run:** `max_applications` submitted and `max_assessments` assessed, with a
  random `delay_seconds` pause between applications.
- **Fatal errors stop the run:** signed out, a bot check that does not clear, or the
  portfolio API unreachable. Every posting after one of those would fail the same way. A
  closed browser is not one of them in the controller: it is reopened.

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
- **The controller, whole.** Picking, the table, the manual queue, the answer review and the
  setup run are all in terms of `JobBoard`, so a new adapter gets every one of them without
  knowing they exist. `ApplyContext.probe` stops at the first question step and reports the
  questions and the profile's resumes instead of answering anything
  (`Submission(probe=Probe(...))`), which is the whole of the setup run.
- **The manual queue.** `fetch` sets `Posting.apply_url` — the board's own apply flow, or the
  posting page whose button links out — and that is what *Open* opens in your browser.
- **One tab.** An adapter never opens one; `browser.page` is all it reaches for, and the
  controller reopens it if it was closed before the next command.

For LinkedIn Easy Apply, the adapter's `apply` walks the modal's steps and calls
`read_fields` on the modal for each one; `probe` means stopping on its first question step
and returning what `read_fields` found, and `submitted` looks for its "Application sent"
panel. Search and posting pages are the only LinkedIn-specific code.

## JobStreet notes

- Search and posting pages are matched on SEEK's `data-automation` hooks, checked against
  sg.jobstreet.com. Link-out postings are read from the page's embedded server state,
  assessed, and — if they fit — queued for applying by hand.
- The apply flow sits behind a sign-in and is matched by accessible names and visible
  text ("Write a cover letter", "Continue", "Submit application"). If a step stops being
  recognised, the error says which one and where its page was captured. Selectors live in
  `boards/jobstreet/selectors.py`.
- Camoufox evaluates scripts in an isolated world, so page globals like
  `window.SEEK_APOLLO_DATA` are read from the page source, not from JavaScript.

## Tests

```sh
uv run pytest                 # unit: config, answer checking, memory, ledger, pipeline,
                              # controller, setup, server, extension API — all with fakes
uv run pytest -m browser      # the form reader and filler in camoufox, and the extension
                              # end to end in Chromium (build it first; see below)
uv run ruff check .
cd web && npm run lint        # the page's types
cd extension && npm test      # the extension's reader and filler, under jsdom
```

`tests/test_controller.py` drives the whole state machine against a fake board and a fake
browser. What it pins down is the bookkeeping that a double application would come from: a
posting bound for the manual queue is on record as `manual` before anything else happens and
is never submitted by the board, a link-out is assessed and only a fit reaches the queue, and
a closed browser costs one retry of one posting rather than the run.

`tests/test_extension_e2e.py` loads the built extension into a real Chromium (`/usr/bin/
chromium`, or `$APPLIER_CHROMIUM`) against a live controller and local pages on another
origin: filling, the side panel's unknowns and *Remember*, the resume upload, a
framework-controlled form that grows a second step, a manual-queue page filling itself and
*I sent it*, and a link-out's employer form inheriting its posting.

`tests/test_setup.py` covers the other half — arriving at a working profile without writing
a config, and the config surviving being written. One of those tests exists because of a
genuinely nasty bug: *"Do you have a driving licence?"* is answered **No**, and YAML reads a
bare `No` as the boolean false, so the fact came back as `False` and the config stopped
loading altogether. Anything whose own spelling would not survive the round trip is now
written quoted.
