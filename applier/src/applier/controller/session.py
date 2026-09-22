"""The controller: the same run as the CLI's, with two decisions given back to a person.

    for each listing on each selected search:
        ledger    settled before?                     -> shown as history, not touched
        policy    title or company excluded?           -> excluded
        board     link-out, expired, no button?        -> external / unavailable
        rag       job-fit report (cached if paid for)
        policy    verdict, score, missing essentials   -> unfit
                                                     ---- picking ----
        auto_pick on    -> straight to the queue
        auto_pick off   -> pending, until the row's Apply is pressed
        rag       cover letter (cached likewise)
        board     documents, questions, review
                                                     ---- sending ----
        auto_submit on  -> submitted, tab closed      -> applied
        auto_submit off -> left at review, tab kept    -> awaiting_human

Everything that decides is still code, and everything a person decides is a decision the
policy would otherwise have made for them. Nothing here loosens what ``answering`` checks.

The two mistakes this is built around are unchanged from the CLI's pipeline. A posting is
never applied to twice: a real submission is written as ``submitting`` before the click, a
hand-off as ``awaiting_human`` the moment it is handed over, and both are terminal. And an
employer is never told something the candidate did not write down: the review pause shows
what would be filled in, it does not grant the model permission to invent.
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

from rag.settings import get_settings

from .. import boards as board_registry
from ..answering import Answerer
from ..assessment import Assessor, Fit
from ..boards.base import ApplyContext, JobBoard
from ..config import Config, SearchConfig, save
from ..config import load as _load
from ..errors import ApplierError, NotApplicableError, UnanswerableError
from ..ledger import Ledger, Status
from ..llm import Llm
from ..models import ApplyMethod, Listing, Packet, Posting, Probe, Resume, Search
from ..secrets import Secrets
from .events import Bus
from .reviewing import Declined, ReviewingAnswerer
from .setup import BASELINE, SetupQuestion, from_probe, merge, to_profile
from .state import DONE, WAITING, Job, JobState, listing_of, settings_of, settled_as, state_of
from .worker import APPLY, DISCOVER, IMMEDIATE, PROCESS, BoardWorker

logger = logging.getLogger(__name__)

_LOG_SCROLLBACK = 400
# What a mock application puts in the cover letter box to get past the documents step. It is
# never sent: the walk stops on the next step and the tab is closed.
_PLACEHOLDER_LETTER = (
    "Placeholder. This is a setup run reading the form's questions; it is not an application "
    "and will not be submitted."
)
_REVIEW_TIMEOUT = 3600.0


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
        state machine — picking, hand-offs, the tab watcher — against a board and a browser
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
        self.answerer = Answerer(self.llm, config.candidate.all_facts(), log=self.log)
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

        # What the last mock application found, until it is answered or thrown away.
        self._probe: Probe | None = None
        self._probing = False
        self._probe_error: str | None = None

        self._running = False
        self._applied = 0
        self._assessed = 0
        self._stopped_because: str | None = None
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
            handoffs = sum(1 for job in self._jobs.values() if job.state == JobState.AWAITING_HUMAN)
            queued = sum(worker.pending for worker in self._workers.values())
            return {
                "running": self._running,
                "applied": self._applied,
                "assessed": self._assessed,
                "waiting": waiting,
                "openHandoffs": handoffs,
                "queued": queued,
                "handoffCapReached": handoffs >= self.config.run.max_open_handoffs,
                "stoppedBecause": self._stopped_because,
                "boards": {
                    name: {"ready": worker.browser is not None, "pending": worker.pending}
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
                # The file's own facts, not ``all_facts()``. The name, email and phone are
                # offered to the answerer as facts too, but they have their own fields here —
                # showing them in the facts editor would invite saving a second copy of each.
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
            "notes": {
                "letter": self.config.candidate.cover_letter_notes or "",
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
            "autoSubmit": "auto_submit",
            "answers": "answers",
            "maxOpenHandoffs": "max_open_handoffs",
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

            for sent, attribute in run.items():
                if patch.get(sent) is not None:
                    setattr(self.config.run, attribute, patch[sent])
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
            self.packet_resume = self.config.candidate.to_resume()

        self.log("The config was replaced from the editor.")
        self._announce_settings()
        return self.read_config_text()

    def update_profile(self, patch: dict[str, Any]) -> dict[str, Any]:
        """The settings page's structured editors: details, facts, notes, resume, searches."""
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
            if "answerNotes" in patch:
                candidate.answer_notes = (patch["answerNotes"] or "").strip() or None

            if "resume" in patch:
                self._set_resume(patch["resume"] or {})

            if "searches" in patch:
                self.config.searches = [
                    SearchConfig.model_validate(one) for one in (patch["searches"] or [])
                ]

            if "llm" in patch:
                for key, value in (patch["llm"] or {}).items():
                    if hasattr(self.config.llm, key):
                        setattr(self.config.llm, key, value or None if key != "headless" else value)

            self._write()

        self._announce_settings()
        return self.describe()

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
        apply. It stops on the questions step, answers nothing, and closes the tab; nothing
        is written to the ledger, so the posting is still yours to apply to properly later.
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
                packet=Packet(cover_letter=_PLACEHOLDER_LETTER, resume=Resume()),
                answerer=self.answerer,
                submit=False,
                probe=True,
            )

            tab = f"setup:{listing.key}"
            with browser.on(tab):
                submission = board.apply(posting, context)
            browser.close_tab(tab)

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
        self._close_tab(job)
        self._drain_queued()
        return job.as_dict()

    def focus(self, key: str) -> dict[str, Any]:
        """Brings a posting's tab to the front of the board's window.

        Queued rather than awaited: the board's thread may be halfway through another
        application, and the tab comes forward as soon as it comes up for air.
        """
        job = self._job(key)
        if not job.tab:
            raise ControllerError("Nothing has opened a tab for that posting.")

        def bring() -> None:
            browser = self._workers[job.board].browser
            found = browser is not None and browser.focus(job.tab or "")
            with self._lock:
                job.tab_open = found
            if not found:
                self.log(f"The tab for {job.title or job.key} is no longer open.")
            self._publish(job)

        self._dispatch(job.board, IMMEDIATE, f"focus {key}", bring)
        return job.as_dict()

    def mark_submitted(self, key: str) -> dict[str, Any]:
        """*I submitted it.* Records the application and closes the tab."""
        job = self._job(key)
        if job.state != JobState.AWAITING_HUMAN:
            raise ControllerError(f"{job.title or key} is not waiting on you.")

        with self._lock:
            self._enter(job, JobState.APPLIED, "you submitted it")
            self._settle(job)
            self._applied += 1
        self._close_tab(job)
        self.log(f"APPLIED (by hand): {job.title or job.key}")
        self._drain_queued()
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
        """Opens the board's sign-in page in a tab of its own, for a person to use."""

        def open_login() -> None:
            worker = self._workers[board]
            if worker.browser is None or worker.board is None:
                return
            with worker.browser.on(f"login:{board}") as page:
                page.goto(worker.board.login_url, wait_until="domcontentloaded", timeout=60_000)
            worker.browser.focus(f"login:{board}")
            self.log(f"Sign in to {board} in the window that just came forward.")

        self._dispatch(board, IMMEDIATE, f"login {board}", open_login)
        return {"board": board}

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
            self._walk(worker, board, search)
        except ApplierError as error:
            # Signed out, a bot wall, the browser gone: every search after this would fail
            # the same way, slowly, so the run says why and stops rather than grinding.
            self.log(f"{search.board}: {error}")
            self.stop(str(error))
        except Exception as error:
            logger.exception("Searching %s raised.", search.board)
            self.stop(f"{type(error).__name__}: {error}")

    def _walk(self, worker: BoardWorker, board: JobBoard, search: Search) -> None:
        board.ensure_signed_in()

        for listing in board.search(search):
            if not self._running:
                return
            worker.pump()

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
        except ApplierError as error:
            self._fail(job, _state_for(error), str(error))
            if error.fatal:
                self.stop(str(error))
        except Exception as error:
            logger.exception("Processing %s raised.", key)
            self._fail(job, JobState.ERROR, f"{type(error).__name__}: {error}")

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

        if posting.method != ApplyMethod.QUICK:
            state = (
                JobState.EXTERNAL
                if posting.method == ApplyMethod.EXTERNAL
                else JobState.UNAVAILABLE
            )
            self._finish(job, state, posting.reason)
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
                )
            self._publish(job)

    def _apply(self, key: str) -> None:
        job = self._job(key)
        worker = self._worker(job.board)
        board, browser = worker.board, worker.browser
        if board is None or browser is None:
            return

        with self._lock:
            if job.state != JobState.QUEUED:
                return
            config = self.config
            if self._applied >= config.policy.max_applications:
                self._enter(job, JobState.PENDING, "the per-run application limit was reached")
                self._publish(job)
                return
            hand_off = not self.config.run.auto_submit
            if hand_off and self._open_handoffs() >= self.config.run.max_open_handoffs:
                # Stays queued: the drain picks it up the moment a hand-off is resolved.
                job.reason = f"waiting — {self.config.run.max_open_handoffs} hand-offs are open"
                self._publish(job)
                return

        listing = listing_of(job)

        try:
            self._fill(job, board, browser, listing, hand_off=hand_off)
        except Declined as error:
            self._fail(job, JobState.SKIPPED, str(error))
            self._close_tab(job)
        except UnanswerableError as error:
            self._fail(job, JobState.NEEDS_INPUT, error.message, questions=error.questions)
            self._close_tab(job)
        except ApplierError as error:
            self._fail(job, _state_for(error), str(error))
            if not error.terminal:
                self._close_tab(job)
            if error.fatal:
                self.stop(str(error))
        except Exception as error:
            logger.exception("Applying to %s raised.", key)
            self._fail(job, JobState.ERROR, f"{type(error).__name__}: {error}")
            self._close_tab(job)
        finally:
            self._drain_queued()

    def _fill(
        self, job: Job, board: JobBoard, browser, listing: Listing, *, hand_off: bool
    ) -> None:
        # Assessing it left the posting behind; only a shortlist restored from the ledger,
        # or a retry in a later session, has to go and read it again.
        with self._lock:
            posting = self._postings.get(job.key)
        if posting is None:
            posting = board.fetch(listing)
            with self._lock:
                self._postings[job.key] = posting

        self._enter_and_publish(job, JobState.WRITING)
        letter = self.ledger.cached_letter(job.key) or self.assessor.letter(
            posting.text, self.config.candidate.cover_letter_notes
        )
        with self._lock:
            job.letter = letter

        # Written before the form is touched, exactly as the CLI pipeline does it: a real
        # submission is marked terminal first, so a process that dies between the click and
        # the next write can never be retried into a second application.
        self.ledger.record(
            listing,
            Status.ERROR if hand_off else Status.SUBMITTING,
            reason="applying",
            report=job.report,
            letter=letter,
            title=job.title,
            company=job.company,
        )

        tab = job.key
        with self._lock:
            job.tab = tab
            self._enter(job, JobState.APPLYING)
        self._publish(job)

        context = ApplyContext(
            packet=Packet(cover_letter=letter, resume=self.packet_resume),
            answerer=self._answerer_for(job),  # type: ignore[arg-type]
            submit=not hand_off,
            capture_steps=self.config.browser.capture_steps,
            hand_off=hand_off,
        )

        with browser.on(tab):
            submission = board.apply(posting, context)

        with self._lock:
            job.answers = dict(submission.answers)

        if submission.handed_off:
            with self._lock:
                job.tab_open = True
                self._enter(
                    job, JobState.AWAITING_HUMAN, "filled in — read it and send it yourself"
                )
                self._settle(job)
            browser.focus(tab)
            self._publish(job)
            self.log(f"HANDED OVER: {job.title or job.key} — the tab is open at its review page.")
            return

        with self._lock:
            self._applied += 1
            self._enter(job, JobState.APPLIED, None)
            self._settle(job)
        self._close_tab(job)
        self._publish(job)
        self.log(f"APPLIED: {job.title or job.key}")

        # The pause between applications is a rate limit, not a wait, so the loop keeps
        # breathing through it: tabs already handed over can still settle themselves, and a
        # button pressed on the page is answered rather than queued behind a minute of sleep.
        self._pause(random.uniform(*self.config.policy.delay_seconds), self._worker(job.board))

    def _pause(self, seconds: float, worker: BoardWorker) -> None:
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline and self._running:
            time.sleep(min(0.5, deadline - time.monotonic()))
            worker.pump()

    def _answerer_for(self, job: Job) -> ReviewingAnswerer:
        def ask(questions: list[dict[str, Any]]) -> dict[str, Any]:
            return self._pause_for_review(job, questions)

        return ReviewingAnswerer(
            self.answerer,
            level=self.config.run.answers,
            ask=ask,
            add_facts=lambda facts: self.add_facts(facts),
            log=self.log,
        )

    def _pause_for_review(self, job: Job, questions: list[dict[str, Any]]) -> dict[str, Any]:
        """Blocks this board's thread until the page settles the questions.

        The board's tabs are still watched while it waits — the worker's tick runs on this
        thread, so a hand-off from an earlier posting can still record itself.
        """
        signal = threading.Event()
        worker = self._worker(job.board)

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
        while not signal.wait(timeout=1.0):
            worker.pump()
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

    def _tick(self, worker: BoardWorker) -> None:
        """Looks at every tab this board has handed over. Runs between commands.

        This is what settles a hand-off without anyone pressing anything: a tab that has
        reached the board's own confirmation is an application that went, and one the person
        closed without a confirmation is one nobody can vouch for — recorded as unconfirmed,
        never retried, and listed for them to check on the board itself.
        """
        browser = worker.browser
        board = worker.board
        if browser is None or board is None:
            return

        with self._lock:
            handoffs = [
                job
                for job in self._jobs.values()
                if job.state == JobState.AWAITING_HUMAN and job.board == worker.name and job.tab
            ]

        for job in handoffs:
            tab = job.tab or ""
            if not browser.has_tab(tab):
                if job.tab_open:
                    with self._lock:
                        job.tab_open = False
                        self._enter(
                            job,
                            JobState.UNCONFIRMED,
                            "you closed the tab; check the board's own activity list",
                        )
                        self._settle(job)
                    self._publish(job)
                    self._drain_queued()
                continue

            with browser.on(tab):
                sent = board.submitted()

            if sent:
                with self._lock:
                    self._applied += 1
                    self._enter(job, JobState.APPLIED, "you submitted it")
                    self._settle(job)
                self._close_tab(job)
                self._publish(job)
                self.log(f"APPLIED (by hand): {job.title or job.key}")
                self._drain_queued()

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
            headless=self.headless,
            tick=self._tick,
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

    def _open_handoffs(self) -> int:
        return sum(1 for job in self._jobs.values() if job.state == JobState.AWAITING_HUMAN)

    def _drain_queued(self) -> None:
        """Sends every queued posting that a limit is no longer holding back."""
        with self._lock:
            config = self.config
            room = config.policy.max_applications - self._applied
            slots = (
                self.config.run.max_open_handoffs - self._open_handoffs()
                if not self.config.run.auto_submit
                else room
            )
            ready = [
                job
                for job in sorted(self._jobs.values(), key=_ordering)
                if job.state == JobState.QUEUED
            ][: max(0, min(room, slots))]

        for job in ready:
            worker = self._worker(job.board)
            worker.submit(APPLY, f"apply {job.key}", lambda k=job.key: self._apply(k))
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

    def _close_tab(self, job: Job) -> None:
        if not job.tab:
            return
        tab, board = job.tab, job.board
        worker = self._workers.get(board)
        if worker is None:
            return

        def close() -> None:
            if worker.browser is not None:
                worker.browser.close_tab(tab)

        with self._lock:
            job.tab_open = False
        worker.submit(IMMEDIATE, f"close tab {tab}", close)

    def _publish(self, job: Job) -> None:
        self.bus.publish("job", job=job.as_dict())

    def _announce(self) -> None:
        self.bus.publish("run", **self.status())

    def _restore(self) -> None:
        """Brings back what a previous session left undecided: the shortlist and the hand-offs.

        A hand-off restored this way has no tab — the browser it lived in is gone — so it is
        shown for what it is: something that was filled in and whose fate only the board knows.
        """
        for status in (Status.PENDING, Status.AWAITING_HUMAN, Status.NEEDS_INPUT):
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
                )
                if entry.status == Status.AWAITING_HUMAN:
                    job.tab = entry.key
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
        self.ledger.close()
        self.bus.close()


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
