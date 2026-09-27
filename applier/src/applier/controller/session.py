"""The controller: the same run as the CLI's, with two decisions given back to a person.

    for each listing on each selected search:
        ledger    settled before?                     -> shown as history, not touched
        policy    title or company excluded?           -> excluded
        board     expired, no button?                  -> unavailable
        rag       job-fit report (cached if paid for)
        policy    verdict, score, missing essentials   -> unfit
                                                     ---- picking ----
        auto_pick on    -> straight to the queue
        auto_pick off   -> pending, until the row's Apply is pressed
        rag       cover letter (cached likewise)
                                                     ---- sending ----
        quick apply, mode auto   -> board fills and submits it        -> applied
        link-out, or mode manual -> manual queue, for the extension    -> manual

A link-out is assessed like any other posting: whether it is worth applying to does not
depend on whose form it is. Only who fills the form does. The board's browser only ever runs
unattended work, in one tab it reopens if it is closed; anything a person applies to by hand
they open in their own browser, where the extension fills it from the same facts and the
same remembered answers.

Everything that decides is still code, and everything a person decides is a decision the
policy would otherwise have made for them. Nothing here loosens what ``answering`` checks.

The two mistakes this is built around are unchanged from the CLI's pipeline. A posting is
never applied to twice: a real submission is written as ``submitting`` before the click, and
a posting in the manual queue as ``manual``, and both are terminal. And an employer is never
told something the candidate did not write down: the review pause shows what would be filled
in, it does not grant the model permission to invent.
"""

from __future__ import annotations

import logging
import random
import threading
import time
from collections import deque
from collections.abc import Callable
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from pydantic import ValidationError
from rag.settings import get_settings

from .. import boards as board_registry
from ..answering import Answerer, MemoryAnswerer
from ..assessment import Assessor, Fit
from ..boards.base import ApplyContext, JobBoard
from ..config import Config, RunConfig, SearchConfig, save
from ..config import load as _load
from ..errors import (
    ApplierError,
    BrowserClosedError,
    LoginRequiredError,
    NotApplicableError,
    UnanswerableError,
)
from ..forms import FieldHandle
from ..ledger import Ledger, Status
from ..llm import Llm
from ..memory import AnswerMemory
from ..models import Answer, ApplyMethod, Listing, Packet, Posting, Probe, Resume, Search
from ..secrets import Secrets
from .events import Bus
from .reviewing import Declined, ReviewingAnswerer
from .setup import BASELINE, SetupQuestion, from_probe, merge, to_profile
from .state import DONE, WAITING, Job, JobState, listing_of, settings_of, settled_as, state_of
from .worker import APPLY, DISCOVER, IMMEDIATE, PROCESS, BoardWorker

logger = logging.getLogger(__name__)

_LOG_SCROLLBACK = 400
_REVIEW_TIMEOUT = 3600.0
_RESUME_TYPES = {".pdf", ".doc", ".docx", ".rtf", ".txt"}
_RESUME_LIMIT = 5 * 1024 * 1024
_SIGN_IN_TIMEOUT = 600.0


class ControllerError(RuntimeError):
    """Something the page asked for cannot be done. The message reaches the reader."""


class Session:
    """One controller: every board's browser, the ledger, the model, and the table.

    Methods are called from two places. The server's request threads call the public ones
    and only ever queue work; everything named with a leading underscore runs on a board's
    worker thread and is the only thing allowed to touch a browser.
    """

    def __init__(
        self,
        config: Config,
        *,
        headless: bool = False,
        make_board: Callable[[str], JobBoard] | None = None,
        make_browser: Callable[[str], Any] | None = None,
    ):
        """``make_board`` and ``make_browser`` exist for the tests, which drive the whole
        state machine — picking, applying, the manual queue — against a board and a browser
        that are plain objects. Left out, boards come from the registry and browsers are
        camoufox."""
        self.config = config
        self._make_board = make_board
        self._make_browser = make_browser
        self.bus = Bus()
        self.headless = headless

        self.ledger = Ledger(config.state_dir / "ledger.sqlite")
        self.secrets = Secrets(config.state_dir, token_env=config.portfolio.token_env)
        self.llm = Llm(config.llm, get_settings(), log=self.log)
        # Started with whatever token there is, which may be none at all. Retrieval is the
        # only thing that needs one, and the page can supply it before anything is assessed.
        self.assessor = Assessor(
            self.llm,
            api=config.portfolio.api,
            token=self.secrets.portfolio_token,
            log=self.log,
        )
        self.answerer = Answerer(
            self.llm,
            config.candidate.all_facts(),
            notes=config.candidate.answer_notes,
            log=self.log,
        )
        self.memory = AnswerMemory(config.state_dir / "ledger.sqlite")
        self.remembering = MemoryAnswerer(self.answerer, self.memory, log=self.log)
        self.packet_resume = config.candidate.to_resume()

        self._lock = threading.RLock()
        self._jobs: dict[str, Job] = {}
        self._workers: dict[str, BoardWorker] = {}
        self._scrollback: deque[dict[str, Any]] = deque(maxlen=_LOG_SCROLLBACK)
        self._reviews: dict[str, dict[str, Any]] = {}
        self._review_signals: dict[str, threading.Event] = {}
        # Postings kept between assessing one and applying to it, so a picked posting is not
        # fetched a second time. Dropped as soon as the row is settled.
        self._postings: dict[str, Posting] = {}
        # Commands a closed browser cut off, retried once each after it is reopened.
        self._interrupted: set[str] = set()
        # Boards whose window is on its sign-in page, waiting for a person.
        self._signing_in: set[str] = set()

        # What the last mock application found, until it is answered or thrown away.
        self._probe: Probe | None = None
        self._probing = False
        self._probe_error: str | None = None

        self._running = False
        self._applied = 0
        self._assessed = 0
        self._stopped_because: str | None = None
        self._finished: str | None = None
        self._walks = 0
        self._closed = False

        self._restore()

    def log(self, message: str) -> None:
        line = {"line": str(message).rstrip(), "at": time.time()}
        with self._lock:
            self._scrollback.append(line)
        self.bus.publish("log", **line)

    def jobs(self) -> list[dict[str, Any]]:
        with self._lock:
            return [job.as_dict() for job in sorted(self._jobs.values(), key=_ordering)]

    def job(self, key: str) -> dict[str, Any]:
        job = self._job(key)
        data = job.as_dict()
        entry = self.ledger.get(key)
        data |= {
            "report": job.report or (entry.report if entry else None),
            "letter": job.letter or (entry.letter if entry else None),
            "answers": job.answers or (entry.answers if entry else {}),
        }
        return data

    def scrollback(self) -> list[dict[str, Any]]:
        with self._lock:
            return list(self._scrollback)

    def status(self) -> dict[str, Any]:
        with self._lock:
            waiting = sum(1 for job in self._jobs.values() if job.state in WAITING)
            manual = sum(1 for job in self._jobs.values() if job.state == JobState.MANUAL)
            queued = sum(worker.pending for worker in self._workers.values())
            return {
                "running": self._running,
                "applied": self._applied,
                "assessed": self._assessed,
                "waiting": waiting,
                "manual": manual,
                "queued": queued,
                "stoppedBecause": self._stopped_because,
                "finished": self._finished,
                "boards": {
                    name: {
                        "ready": worker.browser is not None,
                        "pending": worker.pending,
                        "signingIn": name in self._signing_in,
                    }
                    for name, worker in self._workers.items()
                },
            }

    def describe(self) -> dict[str, Any]:
        """The whole config as the page needs it. Kept in step with the file, both ways."""
        policy = self.config.policy
        return {
            "configPath": str(self.config.source_path or ""),
            "stateDir": str(self.config.state_dir),
            "portfolioApi": self.config.portfolio.api,
            "model": {"provider": self.config.llm.provider, "site": self.config.llm.site},
            "candidate": {
                "name": self.config.candidate.name,
                "email": self.config.candidate.email,
                "phone": self.config.candidate.phone,
                "facts": dict(self.config.candidate.facts),
                "resume": self.packet_resume.select or str(self.packet_resume.upload or ""),
            },
            "boards": sorted(board_registry.BOARDS),
            "searches": [
                {
                    "index": index,
                    "board": search.board,
                    "keywords": search.keywords,
                    "location": search.location,
                    "url": search.url,
                    "maxPages": search.max_pages,
                    "dateRange": search.date_range,
                    "enabled": search.enabled,
                }
                for index, search in enumerate(self.config.searches)
            ],
            "policy": {
                "minVerdict": policy.min_verdict,
                "minScore": policy.min_score,
                "allowMissingEssentials": policy.allow_missing_essentials,
                "maxApplications": policy.max_applications,
                "maxAssessments": policy.max_assessments,
            },
            "settings": settings_of(self.config),
            "setup": self.setup_state(),
            "ready": self.config.ready(has_token=bool(self.secrets.portfolio_token)),
            "portfolio": self.secrets.describe() | {"api": self.config.portfolio.api},
            "boardHeadless": self.config.browser.headless,
            "notes": {
                "letter": self.config.candidate.cover_letter_notes or "",
                "includeLetter": self.config.candidate.cover_letter,
                "answers": self.config.candidate.answer_notes or "",
            },
            "resume": {
                "select": self.config.candidate.resume.select,
                "upload": str(self.config.candidate.resume.upload or "") or None,
            },
        }

    def update_settings(self, patch: dict[str, Any]) -> dict[str, Any]:
        """Changes a toggle or a threshold, and writes it to the config file.

        There is no session-scoped copy of any of this: the page edits the config, the config
        is saved, and the next ``applier run`` from the command line behaves the way the page
        was last left. Safe to call mid-run — a toggle flipped while postings are queued
        applies to every one that has not started, so turning picking back to manual empties
        the queue into the shortlist rather than racing the applications already under way.
        """
        run = {
            "autoPick": "auto_pick",
            "applyMode": "apply_mode",
            "boardModes": "board_modes",
            "answers": "answers",
        }
        policy = {
            "maxApplications": "max_applications",
            "maxAssessments": "max_assessments",
            "minVerdict": "min_verdict",
            "minScore": "min_score",
            "allowMissingEssentials": "allow_missing_essentials",
        }

        with self._lock:
            was_auto_pick = self.config.run.auto_pick

            changes = {
                attribute: patch[sent]
                for sent, attribute in run.items()
                if patch.get(sent) is not None
            }

            # Validated as the file would be, so a bad value is refused rather than saved.
            try:
                self.config.run = RunConfig.model_validate(self.config.run.model_dump() | changes)
            except ValidationError as error:
                problem = error.errors()[0]["msg"]
                raise ControllerError(f"That setting is not valid: {problem}") from error

            for sent, attribute in policy.items():
                if patch.get(sent) is not None:
                    setattr(self.config.policy, attribute, patch[sent])

            if (chosen := patch.get("searches")) is not None:
                wanted = set(chosen)
                for index, search in enumerate(self.config.searches):
                    search.enabled = index in wanted

            if was_auto_pick and not self.config.run.auto_pick:
                for job in self._jobs.values():
                    if job.state == JobState.QUEUED:
                        self._enter(job, JobState.PENDING, "waiting to be picked")

            self._write()

        self._announce_settings()
        self._drain_queued()
        return settings_of(self.config)

    # --- the config file ------------------------------------------------------

    def _write(self) -> None:
        """Saves the config. Called under the lock, by everything that changes it."""
        try:
            save(self.config)
        except Exception as error:  # a failed save must not take a run down with it
            logger.exception("Saving the config failed.")
            self.log(f"Could not save the config: {error}")

    def _announce_settings(self) -> None:
        self.bus.publish("settings", settings=settings_of(self.config), config=self.describe())

    def read_config_text(self) -> dict[str, Any]:
        """The config file as it is on disk, for the raw editor."""
        path = self.config.source_path
        if path is None or not path.is_file():
            raise ControllerError("This config was not read from a file.")
        return {"path": str(path), "text": path.read_text(encoding="utf-8")}

    def write_config_text(self, text: str) -> dict[str, Any]:
        """Replaces the config with what the raw editor holds, if it is a valid one.

        Validated against the same loader the server started with, and rejected whole: a file
        that would not load is never written, so the editor cannot leave the tool unable to
        start. Searches, thresholds and facts take effect at once; what does not is anything
        a browser or a thread was built from, and the page says so.
        """
        from ..config import parse

        replacement = parse(text, where="that config")
        path = self.config.source_path
        if path is None:
            raise ControllerError("This config was not read from a file.")

        with self._lock:
            path.write_text(text, encoding="utf-8")
            reloaded = _load(path)
            for name in replacement.model_fields_set | {"searches", "candidate", "run", "policy"}:
                if name not in ("source_path", "written_paths", "state_dir"):
                    setattr(self.config, name, getattr(reloaded, name))
            self.answerer.facts = self.config.candidate.all_facts()
            self.answerer.notes = self.config.candidate.answer_notes
            self.packet_resume = self.config.candidate.to_resume()

        self.log("The config was replaced from the editor.")
        self._announce_settings()
        return self.read_config_text()

    def update_profile(self, patch: dict[str, Any]) -> dict[str, Any]:
        """The settings page's structured editors: details, facts, notes, resume, searches,
        the model and the portfolio API."""
        candidate = self.config.candidate

        with self._lock:
            for sent, attribute in (("name", "name"), ("email", "email"), ("phone", "phone")):
                if sent in patch:
                    setattr(candidate, attribute, patch[sent] or ("" if sent == "name" else None))

            if "facts" in patch:
                candidate.facts = {
                    str(key).strip(): str(value).strip()
                    for key, value in (patch["facts"] or {}).items()
                    if str(key).strip() and str(value).strip()
                }
                self.answerer.facts = self.config.candidate.all_facts()

            if "letterNotes" in patch:
                candidate.cover_letter_notes = (patch["letterNotes"] or "").strip() or None

            if patch.get("includeLetter") is not None:
                candidate.cover_letter = bool(patch["includeLetter"])

            if "answerNotes" in patch:
                candidate.answer_notes = (patch["answerNotes"] or "").strip() or None
                self.answerer.notes = candidate.answer_notes

            if "resume" in patch:
                self._set_resume(patch["resume"] or {})

            if "searches" in patch:
                self.config.searches = [
                    SearchConfig.model_validate(one) for one in (patch["searches"] or [])
                ]

            if "portfolioApi" in patch:
                self._set_portfolio_api(patch["portfolioApi"] or "")

            if (hidden := patch.get("boardHeadless")) is not None:
                self.config.browser.headless = bool(hidden)
                self._set_board_windows(bool(hidden))

            if "llm" in patch:
                for key, value in (patch["llm"] or {}).items():
                    if hasattr(self.config.llm, key):
                        setattr(self.config.llm, key, value or None if key != "headless" else value)
                # Tell the llm thread to update its config using task queue
                self.llm.submit(self.llm.reset)

            self._write()

        self._announce_settings()
        return self.describe()

    def _set_portfolio_api(self, url: str) -> None:
        """Where retrieval asks. Changed from the page, and live for the next assessment.

        Only the shape is checked here. Whether anything answers at that address is the
        API's business, and it says so in the first assessment rather than in a box.
        """
        address = url.strip().rstrip("/")
        if not address:
            raise ControllerError("The portfolio API needs an address.")
        parts = urlsplit(address)
        if parts.scheme not in ("http", "https") or not parts.netloc:
            raise ControllerError(
                f"{url.strip()} is not an API address — it wants to start http:// or https://."
            )

        self.config.portfolio.api = address
        self.assessor.api = address

    def store_resume(self, name: str, data: bytes) -> dict[str, Any]:
        """Keeps a resume the page uploaded, and sends it with applications from now on.

        Stored under the state directory, so the config names a file this tool owns rather
        than wherever it happened to be on the machine when it was picked.
        """
        filename = Path(name.strip()).name
        
        # Check for valid file extensions
        if Path(filename).suffix.lower() not in _RESUME_TYPES:
            raise ControllerError(
                f"{filename or 'That file'} is not a resume JobStreet takes: "
                f"{', '.join(sorted(_RESUME_TYPES))}."
            )

        if not data:
            raise ControllerError("That file is empty.")

        if len(data) > _RESUME_LIMIT:
            raise ControllerError("JobStreet takes resumes up to 5 MB.")

        # Write the resume file and update the setting path
        folder = self.config.state_dir / "resumes"
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / filename
        path.write_bytes(data)

        with self._lock:
            self._set_resume({"upload": str(path)})
            self._write()

        self.log(f"Resume set: {filename}")
        self._announce_settings()
        return self.describe()

    def forget_resume(self) -> dict[str, Any]:
        """Stops sending a file; the board's own default resume goes instead."""
        with self._lock:
            self._set_resume({})
            self._write()
        self._announce_settings()
        return self.describe()

    def _set_board_windows(self, hidden: bool) -> None:
        """Hides every board's window now, or keeps one up throughout. On each board's thread."""
        for worker in list(self._workers.values()):

            def apply(worker: BoardWorker = worker) -> None:
                if worker.browser is None:
                    return
                worker.browser.hidden = hidden
                if not hidden:
                    worker.browser.show("you asked to see it")
                # Hiding happens as this command ends: BoardWorker settles every command.

            worker.submit(IMMEDIATE, "board window", apply)

    def _set_resume(self, resume: dict[str, Any]) -> None:
        select = (resume.get("select") or "").strip() or None
        upload = (resume.get("upload") or "").strip() or None
        if select and upload:
            raise ControllerError(
                "A resume is either one already on the board profile or a file, not both."
            )
        if upload and not Path(upload).expanduser().is_file():
            raise ControllerError(f"There is no file at {upload}.")

        self.config.candidate.resume.select = select
        self.config.candidate.resume.upload = Path(upload).expanduser() if upload else None
        self.config.written_paths.pop("resume", None)
        self.packet_resume = self.config.candidate.to_resume()

    # --- setting up ----------------------------------------------------------

    def setup_state(self) -> dict[str, Any]:
        """Where setup has got to, and what is still in the way of a first run."""
        with self._lock:
            probe, probing, error = self._probe, self._probing, self._probe_error

        return {
            "done": self.config.setup_done,
            "probing": probing,
            "error": error,
            "missing": self.config.ready(),
            "found": None
            if probe is None
            else {
                "role": probe.role,
                "company": probe.company,
                "url": probe.url,
                "resumes": list(probe.resumes),
                "questions": len(probe.questions),
            },
            "questions": [question.as_dict() for question in self._setup_questions(probe)],
        }

    def _setup_questions(self, probe: Probe | None) -> list[SetupQuestion]:
        """What the page asks: this employer's questions first, then the common ones."""
        found = from_probe(probe) if probe is not None else []
        questions = merge(found, BASELINE)

        # Anything already answered is shown answered, so re-running setup is a review
        # rather than a retyping.
        candidate = self.config.candidate
        known = {key.casefold(): value for key, value in candidate.facts.items()}
        for question in questions:
            if question.target == "name":
                question.hint = candidate.name or question.hint
            if answer := known.get(question.fact_key.casefold()):
                question.hint = f"Currently: {answer}"

        return questions

    def probe(self, url: str = "", *, board: str = "") -> dict[str, Any]:
        """Runs the mock application. Queued on the board's thread; watch it in the window.

        This is the one thing here that touches a real employer's form without meaning to
        apply. It stops on the questions step and answers nothing; nothing is written to the
        ledger, so the posting is still yours to apply to properly later.
        """
        target = url.strip()
        name = (board or self._only_board()).strip()

        with self._lock:
            if self._probing:
                raise ControllerError("A mock application is already running.")
            self._probing = True
            self._probe_error = None

        self.bus.publish("setup", **self.setup_state())
        label = f"mock application: {target or 'the first result'}"
        self._dispatch(name, IMMEDIATE, label, lambda: self._probe_run(name, target))
        return self.setup_state()

    def _only_board(self) -> str:
        boards = {search.board for search in self.config.searches} or set(board_registry.BOARDS)
        return sorted(boards)[0]

    def _probe_run(self, name: str, url: str) -> None:
        worker = self._workers[name]
        board, browser = worker.board, worker.browser

        try:
            if board is None or browser is None:
                raise ControllerError(f"The {name} browser is not open.")

            board.ensure_signed_in()
            listing = board.listing_for(url) if url else self._first_result(board)
            posting = board.fetch(listing)

            if posting.method != ApplyMethod.QUICK:
                raise ControllerError(
                    f"That posting cannot be applied to here ({posting.reason}). "
                    "Pick another one — a mock application needs a form to read."
                )

            self.log(f"Mock application: {posting.title or listing.url}")
            context = ApplyContext(
                packet=Packet(cover_letter=None, resume=Resume()),
                answerer=self.answerer,
                submit=False,
                probe=True,
            )

            submission = board.apply(posting, context)

            if submission.probe is None:
                raise ControllerError(
                    "That form asked nothing this could read. Try another posting — some "
                    "employers ask no questions at all, which is good news for applying and "
                    "no help for setting up."
                )

            with self._lock:
                self._probe = submission.probe
            self.log(f"Found {len(submission.probe.questions)} question(s) on that form.")

        except (ApplierError, ControllerError) as error:
            with self._lock:
                self._probe_error = str(error)
            self.log(f"The mock application stopped: {error}")
        except Exception as error:
            logger.exception("The mock application raised.")
            with self._lock:
                self._probe_error = f"{type(error).__name__}: {error}"
        finally:
            with self._lock:
                self._probing = False
            self.bus.publish("setup", **self.setup_state())

    def _first_result(self, board: JobBoard) -> Listing:
        """A posting to read a form from, when none was named: the first one a search finds."""
        for search in self.config.searches:
            if search.board != board.name:
                continue
            for listing in board.search(search.to_search()):
                return listing

        raise ControllerError(
            "Paste a posting to read the form from — there are no searches yet to find one with."
        )

    def preview(self, search: dict[str, Any]) -> dict[str, Any]:
        """The first page a search turns up, assessed by nothing. For trying keywords out."""
        config = SearchConfig.model_validate({**search, "max_pages": 1})
        found: list[dict[str, Any]] = []
        done = threading.Event()
        problem: list[str] = []

        def look() -> None:
            worker = self._workers[config.board]
            try:
                if worker.board is None:
                    raise ControllerError("That board's browser is not open.")
                worker.board.ensure_signed_in()
                for listing in worker.board.search(config.to_search()):
                    found.append(
                        {
                            "key": listing.key,
                            "url": listing.url,
                            "title": listing.title,
                            "company": listing.company,
                            "location": listing.location,
                        }
                    )
                    if len(found) >= 20:
                        break
            except Exception as error:
                problem.append(str(error))
            finally:
                done.set()

        self._dispatch(config.board, IMMEDIATE, "preview a search", look)

        if not done.wait(timeout=120):
            raise ControllerError("The board is taking too long. Try again in a moment.")
        if problem:
            raise ControllerError(problem[0])

        return {"listings": found}

    def suggest_searches(self) -> dict[str, Any]:
        """Roles the portfolio's own contents argue for, as searches to tick.

        The rest of this project measures a posting against the portfolio; this points the
        same retrieval the other way and asks what to look for in the first place. It is the
        one part of setup that needs the portfolio API, the rag worker and a model, so it is
        a button and never a step: everything else works without any of them.
        """
        from langchain_core.prompts import ChatPromptTemplate

        from .setup import SUGGEST_SYSTEM, SUGGEST_USER, SuggestedSearches

        prompt = ChatPromptTemplate.from_messages(
            [("system", SUGGEST_SYSTEM), ("user", SUGGEST_USER)]
        )

        def work() -> SuggestedSearches:
            passages = self.assessor.retriever.search(
                [
                    "what this person built and how",
                    "technologies and systems worked with",
                    "responsibilities and the scope of the work",
                    "projects, their purpose and their outcome",
                ]
            )
            if not passages:
                raise ControllerError(
                    "The portfolio returned nothing to read. Is it indexed, and is the rag "
                    "worker running?"
                )

            rendered = "\n\n".join(
                f"[{passage.source_type}: {passage.source_label}]\n{passage.content}"
                for passage in passages[:40]
            )
            return self.llm.structured(prompt, {"passages": rendered}, SuggestedSearches)

        try:
            suggested = self.llm.call(work)
        except ControllerError:
            raise
        except Exception as error:
            raise ControllerError(f"Could not read the portfolio: {error}") from error

        board = self._only_board()
        return {
            "searches": [
                {
                    "board": board,
                    "keywords": one.keywords,
                    "why": one.why,
                    "evidence": one.evidence,
                }
                for one in suggested.searches
            ]
        }

    def save_setup(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Writes what setup collected into the config, and marks it done."""
        answers = {str(key): str(value) for key, value in (payload.get("answers") or {}).items()}

        with self._lock:
            questions = self._setup_questions(self._probe)
            details, facts = to_profile(questions, answers)
            candidate = self.config.candidate

            candidate.name = details.get("name") or candidate.name
            candidate.email = details.get("email") or candidate.email
            candidate.phone = details.get("phone") or candidate.phone
            candidate.facts.update(facts)

            if resume := payload.get("resume"):
                self._set_resume(resume)
            if (letter := payload.get("letterNotes")) is not None:
                candidate.cover_letter_notes = letter.strip() or None
            if (notes := payload.get("answerNotes")) is not None:
                candidate.answer_notes = notes.strip() or None
            if (searches := payload.get("searches")) is not None:
                self.config.searches = [SearchConfig.model_validate(one) for one in searches]

            self.answerer.facts = candidate.all_facts()
            self.answerer.notes = candidate.answer_notes
            self.config.setup_done = True
            self._probe = None
            self._write()

        self.log(f"Setup saved: {len(facts)} fact(s) written down.")
        self._announce_settings()
        self.bus.publish("setup", **self.setup_state())
        return self.describe()

    def skip_setup(self) -> dict[str, Any]:
        """Leaves setup without finishing it. The run will simply ask more often."""
        with self._lock:
            self.config.setup_done = True
            self._write()
        self._announce_settings()
        self.bus.publish("setup", **self.setup_state())
        return self.describe()

    def sign_in_site(self, site: str) -> dict[str, Any]:
        """Opens the chat site in a window for you to sign in to. Queued, not waited on.

        The model's browser and this share one profile and a profile holds a lock, so the
        provider is closed first and reopens on its next use. That is the whole cost: a page
        load, once, the next time something asks the model anything.
        """
        from rag.webchat.sites import SITES

        key = site.strip().lower()
        if key not in SITES:
            known = ", ".join(sorted(SITES))
            raise ControllerError(f"No chat site named {site!r}. Known sites: {known}.")

        def work() -> None:
            from rag.webchat import WebChatSession

            self.llm.release()
            self.log(f"Opening {SITES[key].name} — sign in there; the window waits for you.")
            try:
                with WebChatSession(
                    SITES[key],
                    browser=self.config.llm.browser,
                    headless=False,
                    login_timeout=600,
                    log=self.log,
                ):
                    self.log(f"Signed in to {SITES[key].name}. The profile is kept.")
                    signed_in = True
            except Exception as error:
                self.log(f"{SITES[key].name}: {error}")
                signed_in = False

            self.bus.publish("sites", site=key, signedIn=signed_in)

        self.llm.submit(work)
        return {"site": key}

    def site_states(self) -> dict[str, Any]:
        """Whether the configured chat site's saved sign-in still works. Answered by an event.

        Opening the profile headless and seeing whether it lands signed in is the only honest
        way to know, and it takes seconds — so it is asked for rather than kept fresh.
        """
        from rag.webchat.sites import SITES

        key = self.config.llm.site.strip().lower()
        if self.config.llm.provider != "web" or key not in SITES:
            return {"site": None}

        def work() -> None:
            from rag.webchat import WebChatSession

            self.llm.release()
            try:
                with WebChatSession(
                    SITES[key],
                    browser=self.config.llm.browser,
                    headless=True,
                    login_timeout=45,
                    log=lambda _message: None,
                ):
                    signed_in = True
            except Exception:
                signed_in = False

            self.bus.publish("sites", site=key, signedIn=signed_in)

        self.llm.submit(work)
        return {"site": key}

    def set_portfolio_token(self, token: str) -> dict[str, Any]:
        """Takes the token the page pasted, keeps it, and uses it from the next call on.

        Kept in the state directory rather than in ``applier.yaml``: the config is a file you
        would hand somebody to show how this is set up, and a credential has no business in
        one. It is never sent back to the page — all the page is ever told is whether there
        is one and where it came from.
        """
        with self._lock:
            self.secrets.set_portfolio_token(token)
            self.assessor.token = self.secrets.portfolio_token

        self.log("The portfolio token was set.")
        self._announce_settings()
        return self.secrets.describe()

    def forget_portfolio_token(self) -> dict[str, Any]:
        """Drops the stored token. Whatever is in the environment takes over again."""
        with self._lock:
            self.secrets.forget_portfolio_token()
            self.assessor.token = self.secrets.portfolio_token

        self._announce_settings()
        return self.secrets.describe()

    def providers(self) -> dict[str, Any]:
        """What the model could be, and whether each option is actually usable right now.

        A key is never read, shown or stored here. All the page learns is whether the
        variable the config names has something in it, which is what it needs to tell you
        why a run would fail before you start one.
        """
        from rag.providers import available
        from rag.webchat.sites import SITES

        llm = self.config.llm
        return {
            "sites": [{"id": key, "name": site.name} for key, site in sorted(SITES.items())],
            "apis": sorted(available()),
            "current": {
                "provider": llm.provider,
                "site": llm.site,
                "model": llm.model,
                "browser": llm.browser,
                "headless": llm.headless,
                # A chat site has no key at all, so naming a variable for one would be a
                # field that looks like a setting and is not.
                "keyVariable": None if llm.provider == "web" else llm.key_variable,
                "keyIsSet": llm.key_is_set(),
            },
        }

    def start(self) -> dict[str, Any]:
        """Begins discovery on every selected search."""
        with self._lock:
            if self._running:
                raise ControllerError("The run is already going.")
            chosen = [search.to_search() for _, search in self.config.enabled_searches()]
            if not chosen:
                raise ControllerError(
                    "Pick at least one search first."
                    if self.config.searches
                    else "There are no searches yet. Add one on the settings page."
                )
            self._running = True
            self._stopped_because = None
            self._finished = None
            self._walks = len(chosen)
            self._applied = self._assessed = 0

        for search in chosen:
            label = f"search {search.keywords or search.url}"
            self._dispatch(search.board, DISCOVER, label, lambda s=search: self._discover(s))

        self.log(f"Started: {len(chosen)} search(es).")
        self._announce()
        return self.status()

    def stop(self, reason: str = "stopped") -> dict[str, Any]:
        """Drops everything not yet started. What is in flight finishes.

        A half-filled form abandoned is worse than one carried to its review page, and a
        submission already clicked has to be waited out either way.
        """
        with self._lock:
            self._running = False
            self._stopped_because = reason
            for job in self._jobs.values():
                if job.state == JobState.QUEUED:
                    self._enter(job, JobState.PENDING, "the run was stopped")

            # Set state to be thrown away or retried
            for key, signal in self._review_signals.items():
                self._reviews.setdefault(key, {"action": "discard"})
                signal.set()

        for worker in self._workers.values():
            worker.clear()

        self.log(f"Stopped: {reason}. Anything in flight will finish.")
        self._announce()
        return self.status()

    def approve(self, key: str) -> dict[str, Any]:
        """Picks a pending posting. It joins the queue behind whatever is already there."""
        job = self._job(key)
        if job.state != JobState.PENDING:
            raise ControllerError(
                f"{job.title or key} is {job.state.value}, not waiting to be picked."
            )
        with self._lock:
            self._enter(job, JobState.QUEUED, "picked")
        self._drain_queued()
        return job.as_dict()

    def skip(self, key: str, reason: str = "you passed on it") -> dict[str, Any]:
        """Says no to a posting, whatever stage it is at short of a submission."""
        job = self._job(key)
        if job.state in (JobState.APPLIED, JobState.UNCONFIRMED):
            raise ControllerError("That one has already been sent.")

        with self._lock:
            self._enter(job, JobState.SKIPPED, reason)
            self._settle(job)
        self._publish(job)
        self._drain_queued()
        return job.as_dict()

    def mark_submitted(self, key: str) -> dict[str, Any]:
        """*I sent it.* Records an application made by hand, from the page or the extension.

        A posting in the manual queue from an earlier session that this one never loaded is
        settled in the ledger directly: the extension can be pointed at any of them.
        """
        with self._lock:
            job = self._jobs.get(key)

        if job is None:
            entry = self.ledger.get(key)
            if entry is None or entry.status not in (Status.MANUAL, Status.AWAITING_HUMAN):
                raise ControllerError(f"{key} is not waiting on you.")
            self.ledger.settle(key, Status.APPLIED, reason="you submitted it")
            self.log(f"APPLIED (by hand): {entry.title or key}")
            return {"key": key, "state": JobState.APPLIED.value}

        if job.state != JobState.MANUAL:
            raise ControllerError(f"{job.title or key} is not waiting on you.")

        with self._lock:
            self._enter(job, JobState.APPLIED, "you submitted it")
            self._settle(job)
        self._publish(job)
        self.log(f"APPLIED (by hand): {job.title or job.key}")
        return job.as_dict()

    def decide_review(self, key: str, decision: dict[str, Any]) -> dict[str, Any]:
        """Settles a paused answer review: approve (with edits), add facts and retry, or discard."""
        with self._lock:
            signal = self._review_signals.get(key)
            if signal is None:
                raise ControllerError("That review is no longer open.")
            self._reviews[key] = decision
            signal.set()
        return {"ok": True}

    def add_facts(self, facts: dict[str, str]) -> dict[str, str]:
        """Writes down a fact that answers may be built from, for good.

        A fact typed into a review pause is the most valuable thing this ever collects:
        somebody was asked a real question by a real employer and gave the real answer. So it
        goes into the config there and then, not just into this session — the next posting
        that asks the same thing is answered without stopping, and so is the next run, and so
        is ``applier run`` tomorrow.
        """
        cleaned = {k.strip(): v.strip() for k, v in facts.items() if k.strip() and v.strip()}
        if not cleaned:
            raise ControllerError("A fact needs a name and a value.")

        with self._lock:
            self.config.candidate.facts.update(cleaned)
            self.answerer.facts = self.config.candidate.all_facts()
            self._write()

        self.log(f"Wrote down {len(cleaned)} fact(s).")
        self._announce_settings()
        return dict(self.answerer.facts)

    def manual_for(self, url: str) -> dict[str, Any] | None:
        """The manual-queue posting a page in the person's browser belongs to, if any.

        Found by address: the posting's own page, or anywhere in its apply flow beneath it.
        """
        entry = self.ledger.find_by_url(url, {Status.MANUAL, Status.AWAITING_HUMAN})

        if entry is None:
            return None

        with self._lock:
            job = self._jobs.get(entry.key)

        return {
            "key": entry.key,
            "title": (job.title if job else None) or entry.title,
            "company": (job.company if job else None) or entry.company,
            "url": entry.url,
            "applyUrl": entry.apply_url or entry.url,
            "verdict": entry.verdict,
            "score": entry.score,
            "headline": (entry.report or {}).get("headline"),
            "hasLetter": bool(entry.letter),
        }

    def letter_for(self, key: str) -> str:
        """The cover letter for a manual-queue posting: the one written for it, or a new one."""
        entry = self.ledger.get(key)

        if entry is None:
            raise ControllerError(f"Nothing on record for {key}.")

        if entry.letter:
            return entry.letter

        raise ControllerError("No letter was written for that posting.")

    def suggest_answers(
        self,
        fields: list[dict[str, Any]],
        *,
        role: str = "",
        use_model: bool = True,
    ) -> dict[str, Any]:
        """Answers for a form in the person's own browser. Never stops for a gap.

        Whatever cannot be answered comes back as ``unknown``, for the side panel to ask.
        """
        handles = [FieldHandle(raw) for raw in fields if raw.get("id") and raw.get("kind")]
        answers, sources = self.remembering.suggest(handles, role=role, use_model=use_model)
        unknown = [
            handle.field.describe()
            | {"label": handle.field.label, "kind": handle.field.kind}
            for handle in handles
            if handle.field.kind != "file"
            and handle.field.id not in answers
            and not handle.field.current
        ]
        return {
            "answers": answers,
            "sources": sources,
            "unknown": unknown,
            "resume": self.packet_resume.upload is not None,
        }

    def remember_answer(self, field: dict[str, Any], answer: Answer) -> dict[str, Any]:
        """Keeps an answer a person gave in the extension, shaped to the form that asked."""
        handle = FieldHandle(field)
        if not handle.field.label.strip():
            raise ControllerError("A question needs a label to be remembered by.")
        from .reviewing import check_edit

        try:
            value = check_edit(handle, answer)
        except ValueError as error:
            raise ControllerError(str(error)) from error
        self.memory.remember(handle.field, value, "extension")
        self.log(f"Remembered an answer to: {handle.field.label}")
        return {"label": handle.field.label, "answer": value}

    def remembered(self) -> list[dict[str, Any]]:
        return [entry.as_dict() for entry in self.memory.entries()]

    def forget_answer(self, key: str) -> bool:
        return self.memory.forget(key)

    def resume_file(self) -> Path:
        upload = self.packet_resume.upload
        if upload is None or not upload.is_file():
            raise ControllerError(
                "No resume file is set. Choose one under Settings → Profile (a file, not one "
                "already on the board)."
            )
        return upload

    def retry(self, key: str) -> dict[str, Any]:
        """Puts a posting that was skipped for a missing fact back in the queue."""
        job = self._job(key)
        if job.state not in (JobState.NEEDS_INPUT, JobState.ERROR, JobState.SKIPPED):
            raise ControllerError(
                f"{job.title or key} is {job.state.value}; there is nothing to retry."
            )

        with self._lock:
            job.historic = False
            self._enter(job, JobState.QUEUED, "retrying")
        self._drain_queued()
        return job.as_dict()

    def sign_in(self, board: str) -> dict[str, Any]:
        """Opens the board's sign-in page in a window, and waits there for a person to use it."""

        def open_login() -> None:
            worker = self._workers[board]
            if worker.board is None:
                return
            try:
                signed_in = worker.board.is_signed_in()
            except ApplierError:
                signed_in = False
            if signed_in:
                self.bus.publish("boards", board=board, signedIn=True)
                return
            self._sign_in_here(worker)

        self._dispatch(board, IMMEDIATE, f"login {board}", open_login)
        return {"board": board}

    def _sign_in_here(self, worker: BoardWorker) -> bool:
        """Puts the sign-in page in front of a person and waits for them. On the board's thread.

        A hidden browser is brought up for it (``BrowserSession.show``) and hidden again
        once the command is over. Nothing else may use the tab meanwhile: somebody is typing
        a password into it.
        """
        board, browser, name = worker.board, worker.browser, worker.name
        if board is None or browser is None:
            return False

        with self._lock:
            self._signing_in.add(name)

        self._announce()
        signed_in = False
        try:
            browser.show(f"sign in to {name}")
            browser.goto(board.login_url)
            browser.front()
            self.log(f"Sign in to {name} in the window that just opened. The run waits for you.")

            deadline = time.monotonic() + _SIGN_IN_TIMEOUT
            while not self._closed and time.monotonic() < deadline:
                try:
                    signed_in = board.is_signed_in(navigate=False)
                except BrowserClosedError:
                    break
                except ApplierError:
                    signed_in = False
                if signed_in:
                    break
                time.sleep(2)
        finally:
            with self._lock:
                self._signing_in.discard(name)

        self.log(f"Signed in to {name}." if signed_in else f"No sign-in to {name} yet.")
        self.bus.publish("boards", board=name, signedIn=signed_in)
        self._announce()
        return signed_in

    def board_states(self) -> dict[str, Any]:
        """Whether each board in use is signed in. Queued, and answered by an event."""
        for name, worker in list(self._workers.items()):

            def check(worker: BoardWorker = worker, name: str = name) -> None:
                if worker.board is None:
                    return
                try:
                    signed_in = worker.board.is_signed_in()
                except ApplierError:
                    signed_in = False
                self.bus.publish("boards", board=name, signedIn=signed_in)

            worker.submit(IMMEDIATE, f"signed-in {name}", check)
        return {"boards": sorted(self._workers)}

    def _discover(self, search: Search) -> None:
        """Walks a search, turning each listing into a command of its own."""
        worker = self._workers[search.board]
        board = worker.board
        if board is None:
            return

        try:
            try:
                self._walk(worker, board, search)
            except BrowserClosedError:
                if worker.browser is None:
                    raise
                worker.browser.ensure()
                self._walk(worker, board, search)
        except ApplierError as error:
            self.log(f"{search.board}: {error}")
            self.stop(str(error))
        except Exception as error:
            logger.exception("Searching %s raised.", search.board)
            self.stop(f"{type(error).__name__}: {error}")
        finally:
            with self._lock:
                self._walks = max(0, self._walks - 1)
            self._maybe_finish()

    def _walk(self, worker: BoardWorker, board: JobBoard, search: Search) -> None:
        # Always require signing in first before starting the walk
        try:
            board.ensure_signed_in()
        except LoginRequiredError:
            if not self._sign_in_here(worker):
                raise
            board.ensure_signed_in()

        for listing in board.search(search):
            if not self._running:
                return

            if self._register(listing) is None:
                continue
            worker.submit(PROCESS, f"process {listing.key}", lambda k=listing.key: self._process(k))

    def _register(self, listing: Listing) -> Job | None:
        """A listing's row in the table, unless the ledger has already settled it."""
        with self._lock:
            if (existing := self._jobs.get(listing.key)) is not None and not existing.historic:
                return None

            job = Job(
                key=listing.key,
                board=listing.board,
                url=listing.url,
                title=listing.title,
                company=listing.company,
                location=listing.location,
            )

            settled = self.ledger.should_skip(listing.key, retry_skipped=False)
            if settled is not None:
                job.state = state_of(settled)
                job.historic = True
                job.reason = f"already {settled.value}"
                entry = self.ledger.get(listing.key)
                if entry is not None:
                    job.verdict, job.score = entry.verdict, entry.score  # type: ignore[assignment]
                self._jobs[listing.key] = job
                self._publish(job)
                return None

            self._jobs[listing.key] = job
            self._publish(job)
            return job

    def _process(self, key: str) -> None:
        """Fetch, assess and decide one posting. Everything is caught and recorded."""
        job = self._job(key)
        worker = self._worker(job.board)
        board = worker.board
        if board is None or not self._running:
            return

        try:
            self._assess(job, board)
        except Declined as error:
            self._fail(job, JobState.SKIPPED, str(error))
        except UnanswerableError as error:
            self._fail(job, JobState.NEEDS_INPUT, error.message, questions=error.questions)
        except Exception as error:
            if _closed_under(error, worker) or self._signed_back_in(error, worker):
                self._cut_off(job, worker, PROCESS, "process", self._process, error)
            elif isinstance(error, ApplierError):
                self._fail(job, _state_for(error), str(error))
                if error.fatal:
                    self.stop(str(error))
            else:
                logger.exception("Processing %s raised.", key)
                self._fail(job, JobState.ERROR, f"{type(error).__name__}: {error}")
        finally:
            self._maybe_finish()

    def _assess(self, job: Job, board: JobBoard) -> None:
        config = self.config
        listing = listing_of(job)

        if why := config.policy.excluded(job.title, job.company):
            self._finish(job, JobState.EXCLUDED, why)
            return

        self._enter_and_publish(job, JobState.FETCHING)
        posting = board.fetch(listing)
        with self._lock:
            self._postings[job.key] = posting
            job.title = posting.title or job.title
            job.company = posting.company or job.company

        with self._lock:
            job.external = posting.method == ApplyMethod.EXTERNAL
            job.apply_url = posting.apply_url or job.url

        if posting.method == ApplyMethod.UNAVAILABLE:
            self._finish(job, JobState.UNAVAILABLE, posting.reason)
            return

        if why := config.policy.excluded(job.title, job.company):
            self._finish(job, JobState.EXCLUDED, why)
            return

        report = self.ledger.cached_report(job.key)
        if report is None:
            with self._lock:
                if self._assessed >= config.policy.max_assessments:
                    self._enter(job, JobState.PENDING, "the per-run assessment limit was reached")
                    self._publish(job)
                    return
                self._assessed += 1
            self._enter_and_publish(job, JobState.ASSESSING)
            report = self.assessor.fit(posting.text).report

        fit = Fit(report)
        with self._lock:
            job.report = report
            job.verdict, job.score = fit.verdict, fit.score  # type: ignore[assignment]
            job.headline = report.get("headline")
            job.missing_essentials = fit.missing_essentials
        self.log(f"  fit: {fit.line()}")

        shortfall = config.meets(fit.verdict, fit.score, fit.missing_essentials)  # type: ignore[arg-type]
        if shortfall:
            self._finish(job, JobState.UNFIT, shortfall, report=report)
            return

        if self.config.run.auto_pick:
            with self._lock:
                self._enter(job, JobState.QUEUED, "a fit")
            self._publish(job)
            self._drain_queued()
        else:
            with self._lock:
                self._enter(job, JobState.PENDING, "a fit — waiting to be picked")
                self.ledger.record(
                    listing,
                    Status.PENDING,
                    reason="waiting to be picked",
                    report=report,
                    title=job.title,
                    company=job.company,
                    apply_url=job.apply_url,
                )
            self._publish(job)

    def _apply(self, key: str) -> None:
        """Sends a picked posting on its way: submitted by the board, or to the manual queue."""
        job = self._job(key)
        worker = self._worker(job.board)
        board, browser = worker.board, worker.browser
        if board is None or browser is None:
            return

        with self._lock:
            if job.state != JobState.QUEUED:
                return

        listing = listing_of(job)

        try:
            posting = self._posting(job, board, listing)
            # Dead job posting
            if posting.method == ApplyMethod.UNAVAILABLE:
                self._finish(job, JobState.UNAVAILABLE, posting.reason)
                return

            # Manual application required
            if not self._automatic(job, posting):
                self._to_manual(job, posting, listing)
                return

            # Limit reached
            with self._lock:
                if self._applied >= self.config.policy.max_applications:
                    self._enter(job, JobState.PENDING, "the per-run application limit was reached")
                    self._publish(job)
                    return

            self._fill(job, board, posting, listing)
        except Declined as error:
            self._fail(job, JobState.SKIPPED, str(error))
        except UnanswerableError as error:
            self._fail(job, JobState.NEEDS_INPUT, error.message, questions=error.questions)
        except Exception as error:
            # Do not retry for terminal errors
            terminal = isinstance(error, ApplierError) and error.terminal
            if not terminal and (
                _closed_under(error, worker) or self._signed_back_in(error, worker)
            ):
                self._cut_off(job, worker, APPLY, "apply", self._apply, error)

            # Send it to retry queue for user intervention
            elif isinstance(error, ApplierError):
                self._fail(job, _state_for(error), str(error))
                if error.fatal:
                    self.stop(str(error))

            else:
                logger.exception("Applying to %s raised.", key)
                self._fail(job, JobState.ERROR, f"{type(error).__name__}: {error}")
        finally:
            self._drain_queued()
            self._maybe_finish()

    def _automatic(self, job: Job, posting: Posting) -> bool:
        """Whether the board sends this one itself: its own form, and the mode says so."""
        return (
            posting.method == ApplyMethod.QUICK
            and self.config.run.mode_for(job.board) == "auto"
        )

    def _posting(self, job: Job, board: JobBoard, listing: Listing) -> Posting:
        """The posting as assessing left it; only a restored or retried row reads it again."""
        with self._lock:
            posting = self._postings.get(job.key)
        if posting is None:
            posting = board.fetch(listing)
            with self._lock:
                self._postings[job.key] = posting
                job.external = posting.method == ApplyMethod.EXTERNAL
                job.apply_url = posting.apply_url or job.url
        return posting

    def _letter(self, job: Job, posting: Posting) -> str | None:
        """The cover letter, or None when applications go without one."""
        if not self.config.candidate.cover_letter:
            return None
        self._enter_and_publish(job, JobState.WRITING)
        letter = self.ledger.cached_letter(job.key) or self.assessor.letter(
            posting.text, self.config.candidate.cover_letter_notes
        )
        with self._lock:
            job.letter = letter
        return letter

    def _to_manual(self, job: Job, posting: Posting, listing: Listing) -> None:
        """Into the manual queue, with the letter already written for the extension to paste."""
        letter = self._letter(job, posting)
        why = (
            "applies on the employer's site — open it in your browser"
            if job.external
            else "yours to send — open it in your browser"
        )
        with self._lock:
            self._enter(job, JobState.MANUAL, why)
            self._settle(job)
            self.ledger.record(
                listing,
                Status.MANUAL,
                reason=why,
                report=job.report,
                letter=letter,
                title=job.title,
                company=job.company,
                apply_url=job.apply_url,
            )
        self._publish(job)
        self.log(f"MANUAL: {job.title or job.key} — {job.apply_url}")

    def _fill(self, job: Job, board: JobBoard, posting: Posting, listing: Listing) -> None:
        letter = self._letter(job, posting)

        # Written before the form is touched, exactly as the CLI pipeline does it: a real
        # submission is marked terminal first, so a process that dies between the click and
        # the next write can never be retried into a second application.
        self.ledger.record(
            listing,
            Status.SUBMITTING,
            reason="applying",
            report=job.report,
            letter=letter,
            title=job.title,
            company=job.company,
        )

        self._enter_and_publish(job, JobState.APPLYING)

        context = ApplyContext(
            packet=Packet(cover_letter=letter, resume=self.packet_resume),
            answerer=self._answerer_for(job),  # type: ignore[arg-type]
            submit=True,
            capture_steps=self.config.browser.capture_steps,
        )
        submission = board.apply(posting, context)

        with self._lock:
            job.answers = dict(submission.answers)
            self._applied += 1
            self._enter(job, JobState.APPLIED, None)
            self._settle(job)
        self._publish(job)
        self.log(f"APPLIED: {job.title or job.key}")

        # The pause between applications is a rate limit, not a wait, so a button pressed on
        # the page is answered rather than queued behind a minute of sleep.
        self._pause(random.uniform(*self.config.policy.delay_seconds), self._worker(job.board))

    def _signed_back_in(self, error: Exception, worker: BoardWorker) -> bool:
        """A board that asked for a sign-in mid-posting: ask the person, then go again."""
        return isinstance(error, LoginRequiredError) and self._sign_in_here(worker)

    def _cut_off(
        self,
        job: Job,
        worker: BoardWorker,
        priority: int,
        label: str,
        run: Callable[[str], None],
        error: Exception,
    ) -> None:
        """A closed browser cut a command short. It is tried once more, in a fresh window.

        Not a reason to stop the run: the window is reopened before the next command
        (``BrowserSession.ensure``), and nothing about this posting has changed.
        """
        with self._lock:
            again = job.key not in self._interrupted and self._running
            self._interrupted.add(job.key)
            if again:
                self._enter(job, JobState.QUEUED if label == "apply" else JobState.FOUND)

        # Try gin if interrupted else just fail the job
        if again:
            self.log(f"  the browser was closed; trying {job.title or job.key} again")
            self._publish(job)
            worker.submit(priority, f"{label} {job.key}", lambda k=job.key: run(k))
            return

        self._fail(job, JobState.ERROR, str(error))

    def _pause(self, seconds: float, worker: BoardWorker) -> None:
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline and self._running:
            time.sleep(max(0.0, min(0.5, deadline - time.monotonic())))
            worker.pump()

    def _answerer_for(self, job: Job) -> ReviewingAnswerer:
        def ask(questions: list[dict[str, Any]]) -> dict[str, Any]:
            return self._pause_for_review(job, questions)

        return ReviewingAnswerer(
            self.remembering,
            level=self.config.run.answers,
            ask=ask,
            add_facts=lambda facts: self.add_facts(facts),
            remember=lambda handle, answer: self.memory.remember(handle.field, answer, "review"),
            log=self.log,
        )

    def _pause_for_review(self, job: Job, questions: list[dict[str, Any]]) -> dict[str, Any]:
        """Blocks this board's thread until the page settles the questions.

        Nothing else runs on the board meanwhile: its one tab holds the half-filled form.
        Stopping the run, or closing the session, settles it as a discard.
        """
        signal = threading.Event()

        with self._lock:
            job.review = questions
            self._review_signals[job.key] = signal
            self._reviews.pop(job.key, None)
            self._enter(job, JobState.REVIEWING, "waiting for you to check the answers")
        self._publish(job)
        self.bus.publish("review", key=job.key, questions=questions)
        name = job.title or job.key
        self.log(f"Waiting on you: {len(questions)} employer question(s) for {name}.")

        deadline = time.monotonic() + _REVIEW_TIMEOUT
        while not signal.wait(timeout=0.5):
            # Shutting down settles an open review as a discard: a form half-filled is worth
            # less than a session that will not close, and nothing has been sent either way.
            if self._closed or time.monotonic() > deadline:
                break

        with self._lock:
            decision = self._reviews.pop(job.key, None) or {"action": "discard"}
            self._review_signals.pop(job.key, None)
            job.review = []
            self._enter(job, JobState.APPLYING)
        self._publish(job)
        return decision

    def _dispatch(self, board: str, priority: int, label: str, run: Callable[[], None]) -> None:
        """Queues work on a board, off the caller's thread.

        Opening a board's profile takes seconds the first time. A button on the page must not
        wait for that, so the worker is brought up on a thread of its own and the command is
        queued behind it; the page hears what came of it on the event stream, as it does for
        everything else.
        """

        def arrange() -> None:
            try:
                self._worker(board).submit(priority, label, run)
            except Exception as error:
                self.log(f"{board}: {type(error).__name__}: {error}")
                self._announce()

        threading.Thread(target=arrange, name=f"dispatch-{board}", daemon=True).start()

    def _worker(self, board: str) -> BoardWorker:
        """That board's thread, started on first use. Waits for its browser to come up."""
        with self._lock:
            worker = self._workers.get(board)
            if worker is None:
                worker = self._workers[board] = self._build_worker(board)
                worker.start()

        # Outside the lock: opening a profile takes seconds, and nothing else may be held up
        # by it — least of all another board doing the same thing.
        worker.wait_until_ready()
        return worker

    def _build_worker(self, board: str) -> BoardWorker:
        # Only the registry's boards exist, unless something else was handed in to make them.
        if self._make_board is None and board not in board_registry.BOARDS:
            raise ControllerError(f"No board named {board!r}.")

        return BoardWorker(
            board,
            make_board=lambda: self._board_for(board),
            profile=self.config.state_dir / "profiles" / board,
            captures=self.config.state_dir / "captures",
            headless=self.headless or self.config.browser.headless,
            on_error=self._worker_error,
            log=self.log,
            make_browser=(lambda: self._make_browser(board)) if self._make_browser else None,
        )

    def _board_for(self, board: str) -> JobBoard:
        if self._make_board is not None:
            return self._make_board(board)
        return board_registry.create(board, **self.config.boards.for_board(board))

    def _worker_error(self, board: str, error: Exception) -> None:
        self.log(f"{board}: {type(error).__name__}: {error}")
        self._announce()

    def _job(self, key: str) -> Job:
        with self._lock:
            job = self._jobs.get(key)
        if job is None:
            raise ControllerError(f"No posting called {key!r} in this session.")
        return job

    def _drain_queued(self) -> None:
        """Sends every queued posting that a limit is no longer holding back."""
        with self._lock:
            config = self.config
            queued = [
                job
                for job in sorted(self._jobs.values(), key=_ordering)
                if job.state == JobState.QUEUED
            ]
            # The application limit counts submissions. The manual queue is not one, so a
            # posting bound for it is never held back by it.
            room = max(0, config.policy.max_applications - self._applied)
            ready = []
            for job in queued:
                if job.external or config.run.mode_for(job.board) == "manual":
                    ready.append(job)
                elif room > 0:
                    ready.append(job)
                    room -= 1
                elif self._running:
                    self._enter(job, JobState.PENDING, "the per-run application limit was reached")
                    self._settle(job)

        for job in ready:
            worker = self._worker(job.board)
            worker.submit(APPLY, f"apply {job.key}", lambda k=job.key: self._apply(k))
        self._announce()

    def _maybe_finish(self) -> None:
        """Ends the run once there is nothing left for it to do on its own.

        Every search walked, and every posting it found either settled or waiting on a
        person — picked, sent by hand, or checked. A run that stays "running" after that is
        one nobody can tell apart from one still working.
        """
        with self._lock:
            if not self._running or self._walks > 0:
                return

            if any(job.state in _IN_FLIGHT and not job.historic for job in self._jobs.values()):
                return

            self._running = False
            manual = sum(1 for job in self._jobs.values() if job.state == JobState.MANUAL)
            pending = sum(1 for job in self._jobs.values() if job.state == JobState.PENDING)
            parts = [f"{self._applied} applied", f"{self._assessed} assessed"]
            if manual:
                parts.append(f"{manual} to send by hand")
            if pending:
                parts.append(f"{pending} waiting to be picked")
            self._finished = ", ".join(parts)

        self.log(f"Finished: {self._finished}.")
        self._announce()

    def _enter(self, job: Job, state: JobState, detail: str | None = None) -> None:
        job.enter(state, detail)

    def _enter_and_publish(self, job: Job, state: JobState, detail: str | None = None) -> None:
        with self._lock:
            self._enter(job, state, detail)
        self._publish(job)

    def _finish(self, job: Job, state: JobState, reason: str | None, **values: Any) -> None:
        with self._lock:
            self._enter(job, state, reason)
            self._settle(job, **values)
        self._publish(job)
        if reason:
            self.log(f"  {state.value}: {reason}")

    def _fail(self, job: Job, state: JobState, reason: str, **values: Any) -> None:
        with self._lock:
            self._enter(job, state, reason)
            self._settle(job, **values)
        self._publish(job)
        self.log(f"  {state.value}: {reason}")

    def _settle(self, job: Job, **values: Any) -> None:
        """Writes the row's state to the ledger, when it is one worth remembering."""
        status = settled_as(job.state)
        if status is None:
            return
        if job.state in DONE:
            self._postings.pop(job.key, None)
        self.ledger.record(
            listing_of(job),
            status,
            reason=job.reason,
            title=job.title,
            company=job.company,
            report=values.get("report", job.report),
            letter=job.letter,
            answers=job.answers or None,
            questions=values.get("questions") or job.questions or None,
        )
        if questions := values.get("questions"):
            job.questions = list(questions)

    def _publish(self, job: Job) -> None:
        self.bus.publish("job", job=job.as_dict())

    def _announce(self) -> None:
        self.bus.publish("run", **self.status())

    def _restore(self) -> None:
        """Brings back what a previous session left undecided: the shortlist and the manual
        queue, and the postings waiting on a fact."""
        for status in (Status.PENDING, Status.MANUAL, Status.AWAITING_HUMAN, Status.NEEDS_INPUT):
            for entry in self.ledger.entries(status, limit=200):
                job = Job(
                    key=entry.key,
                    board=entry.board,
                    url=entry.url,
                    title=entry.title,
                    company=entry.company,
                    state=state_of(entry.status),
                    reason=entry.reason,
                    verdict=entry.verdict,  # type: ignore[arg-type]
                    score=entry.score,
                    report=entry.report,
                    letter=entry.letter,
                    answers=entry.answers,
                    questions=entry.questions,
                    apply_url=entry.apply_url or entry.url,
                )
                self._jobs[entry.key] = job

    def close(self) -> None:
        with self._lock:
            if self._closed:
                return
            self._closed = True
            self._running = False
            workers = list(self._workers.values())

        for worker in workers:
            worker.stop()
        self.llm.close()
        self.memory.close()
        self.ledger.close()
        self.bus.close()


# Moving on its own: while any posting is in one of these, the run is not over.
_IN_FLIGHT = {
    JobState.FOUND,
    JobState.FETCHING,
    JobState.ASSESSING,
    JobState.QUEUED,
    JobState.WRITING,
    JobState.APPLYING,
    JobState.REVIEWING,
}


def _closed_under(error: Exception, worker: BoardWorker) -> bool:
    """Whether a command failed because its tab or window was closed under it.

    Said outright by :class:`BrowserClosedError`; otherwise it arrives as whatever the call
    in flight raised — a Playwright error, or a flow error wrapping one — and the browser
    itself is the only honest witness.
    """
    if isinstance(error, BrowserClosedError):
        return True
    browser = worker.browser
    return browser is not None and bool(getattr(browser, "interrupted", False))


def _state_for(error: ApplierError) -> JobState:
    if isinstance(error, NotApplicableError):
        return JobState.UNAVAILABLE
    if error.terminal:
        return JobState.UNCONFIRMED
    return JobState.ERROR


def _ordering(job: Job) -> tuple[int, float]:
    """Waiting on a person first, then still moving, then done — newest first within each."""
    if job.state in WAITING:
        rank = 0
    elif job.state in DONE:
        rank = 2
    else:
        rank = 1
    return (rank, -job.updated_at)
