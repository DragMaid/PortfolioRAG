"""The run: every configured search, every new posting, one decision each.

    for each listing:
        ledger    seen before with a terminal status?          -> skip
        policy    title or company excluded?                    -> excluded
        board     expired, no button?                           -> unavailable
        rag       job-fit report (cached if already paid for)
        policy    verdict, score, missing essentials            -> unfit
        board     a link-out to the employer's site?            -> manual (for the extension)
        rag       cover letter (cached likewise)
        board     documents, questions (answered from facts), review, submit
                                                                -> applied / dry_run / needs_input

Every outcome is written to the ledger before the next posting is looked at, so a run that
dies halfway leaves an accurate record and the next run picks up where it stopped.

A fatal error (signed out, bot wall, portfolio API down) ends the run: every posting after
it would fail the same way, slowly, and each of those attempts is a model call or a
page-load a board might count against the account.
"""

from __future__ import annotations

import json
import random
import time
from collections import Counter
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from .answering import AnswerProvider
from .assessment import Assessor, Fit
from .boards.base import ApplyContext, JobBoard
from .config import Config
from .errors import ApplierError, UnanswerableError
from .ledger import Ledger, Status
from .models import ApplyMethod, Listing, Packet, Search


@dataclass(slots=True)
class RunOptions:
    # False stops every application at the review step. Nothing is sent.
    submit: bool = True
    # Try `needs_input` postings again, for when a fact has been added to the config.
    retry_skipped: bool = False
    # Submit regardless of fit. Only for `applier apply <url>`, never a search run.
    ignore_fit: bool = False


@dataclass(slots=True)
class Outcome:
    listing: Listing
    status: Status | None  # None: skipped by the ledger before anything was done
    reason: str | None = None
    fit: str | None = None


@dataclass(slots=True)
class RunSummary:
    started_at: str
    outcomes: list[Outcome] = field(default_factory=list)
    stopped: str | None = None

    def counts(self) -> dict[str, int]:
        return dict(Counter(o.status.value if o.status else "seen" for o in self.outcomes))

    def as_dict(self) -> dict:
        return {
            "started_at": self.started_at,
            "stopped": self.stopped,
            "counts": self.counts(),
            "outcomes": [
                {
                    "key": o.listing.key,
                    "url": o.listing.url,
                    "title": o.listing.title,
                    "company": o.listing.company,
                    "status": o.status.value if o.status else None,
                    "reason": o.reason,
                    "fit": o.fit,
                }
                for o in self.outcomes
                if o.status is not None
            ],
        }


class StopRun(Exception):
    """Internal: a limit was reached or a fatal error happened. Carries why."""


class ApplyPipeline:
    def __init__(
        self,
        config: Config,
        *,
        boards: dict[str, JobBoard],
        assessor: Assessor,
        answerer: AnswerProvider,
        ledger: Ledger,
        log: Callable[[str], None] = print,
        sleep: Callable[[float], None] = time.sleep,
    ):
        self.config = config
        self.boards = boards
        self.assessor = assessor
        self.answerer = answerer
        self.ledger = ledger
        self.log = log
        self.sleep = sleep
        self.packet_resume = config.candidate.to_resume(config.resume_record)

        self._assessed = 0
        self._applied = 0

    def run(self, searches: Iterable[Search], options: RunOptions) -> RunSummary:
        summary = RunSummary(started_at=datetime.now(UTC).isoformat(timespec="seconds"))
        seen: set[str] = set()

        try:
            for board in {search.board for search in searches if search.board in self.boards}:
                self.boards[board].ensure_signed_in()

            for search in searches:
                board = self.boards[search.board]
                self.log(f"Searching {board.name}: {search.url or search.keywords}")

                for listing in board.search(search):
                    if listing.key in seen:
                        continue
                    seen.add(listing.key)
                    summary.outcomes.append(self.process(board, listing, options))
        except StopRun as stop:
            summary.stopped = str(stop)
            self.log(f"Stopped: {stop}")
        except ApplierError as error:
            summary.stopped = str(error)
            self.log(f"Stopped: {error}")

        return summary

    def process(self, board: JobBoard, listing: Listing, options: RunOptions) -> Outcome:
        """One posting, start to finish. Raises StopRun to end the run; nothing else escapes."""
        if status := self.ledger.should_skip(listing.key, retry_skipped=options.retry_skipped):
            return Outcome(listing, None, f"already {status.value}")

        self.log(f"\n{listing.title or listing.url} — {listing.company or 'unknown company'}")

        try:
            return self._process(board, listing, options)
        except UnanswerableError as error:
            self.log(f"  skipped: {error.message}")
            self.ledger.record(
                listing,
                Status.NEEDS_INPUT,
                reason=error.message,
                questions=error.questions,
                artifacts=error.artifacts,
            )
            return Outcome(listing, Status.NEEDS_INPUT, error.message)
        except ApplierError as error:
            status = _status_for(error)
            self.log(f"  {status.value}: {error}")
            self.ledger.record(listing, status, reason=str(error), artifacts=error.artifacts)
            if error.fatal:
                raise StopRun(str(error)) from error
            return Outcome(listing, status, str(error))
        except StopRun:
            raise
        except Exception as error:
            self.log(f"  error: {type(error).__name__}: {error}")
            self.ledger.record(listing, Status.ERROR, reason=f"{type(error).__name__}: {error}")
            return Outcome(listing, Status.ERROR, str(error))

    def _process(self, board: JobBoard, listing: Listing, options: RunOptions) -> Outcome:
        policy = self.config.policy

        if self._applied >= policy.max_applications:
            raise StopRun(f"applied {self._applied}, the per-run limit")

        # Performing listing check (listing is the one-liner preview of the job b4hand)
        if (why := policy.excluded(listing.title, listing.company)) and not options.ignore_fit:
            return self._record(listing, Status.EXCLUDED, why)

        posting = board.fetch(listing)
        details = {"title": posting.title, "company": posting.company}

        # Nobody can apply to it. A link-out can be — by hand — so it is assessed first.
        if posting.method == ApplyMethod.UNAVAILABLE:
            return self._record(listing, Status.UNAVAILABLE, posting.reason, **details)

        # Check for post exclusion (after retrieving the whole content from listing)
        if (why := policy.excluded(posting.title, posting.company)) and not options.ignore_fit:
            return self._record(listing, Status.EXCLUDED, why, **details)

        # A report a previous run paid for is reused
        # the posting has not changed its text.
        report = self.ledger.cached_report(listing.key)
        if report is None:
            if self._assessed >= policy.max_assessments:
                raise StopRun(f"assessed {self._assessed}, the per-run limit")
            self._assessed += 1
            report = self.assessor.fit(posting.text).report

        fit = Fit(report)
        self.log(f"  fit: {fit.line()}")

        # If it was scored too low then don't proceed to apply (unless explicitly said to do so)
        shortfall = self.config.meets(fit.verdict, fit.score, fit.missing_essentials)
        if shortfall and not options.ignore_fit:
            return self._record(listing, Status.UNFIT, shortfall, report=report, fit=fit, **details)

        letter = (
            self.ledger.cached_letter(listing.key)
            or self.assessor.letter(posting.text, self.config.candidate.cover_letter_notes)
            if self.config.candidate.cover_letter
            else None
        )

        # A fit this cannot submit, or one the mode keeps for a person: the manual queue,
        # with its letter written, for the extension to fill in the person's own browser.
        if (
            posting.method == ApplyMethod.EXTERNAL
            or self.config.run.mode_for(listing.board) == "manual"
        ) and not options.ignore_fit:
            return self._record(
                listing,
                Status.MANUAL,
                "a fit — apply in your browser, with the extension",
                report=report,
                fit=fit,
                letter=letter,
                apply_url=posting.apply_url or listing.url,
                **details,
            )

        # Register a placeholder beforehand for progress tracking
        self.ledger.record(
            listing,
            Status.SUBMITTING if options.submit else Status.ERROR,
            reason="applying",
            report=report,
            letter=letter,
            **details,
        )

        submission = board.apply(
            posting,
            ApplyContext(
                packet=Packet(cover_letter=letter, resume=self.packet_resume),
                answerer=self.answerer,
                submit=options.submit,
                capture_steps=self.config.browser.capture_steps,
            ),
        )
        self._applied += 1

        status = Status.APPLIED if submission.submitted else Status.DRY_RUN
        reason = None if submission.submitted else "stopped at review (dry run)"
        outcome = self._record(
            listing,
            status,
            reason,
            report=report,
            fit=fit,
            answers=submission.answers,
            artifacts=submission.artifacts,
            **details,
        )
        self.log(f"  {'APPLIED' if submission.submitted else 'dry run: filled up to review'}")
        if submission.artifacts:
            self.log(f"  review page captured in {submission.artifacts}")

        # Random sleep to not get flagged
        low, high = policy.delay_seconds
        self.sleep(random.uniform(low, high) if submission.submitted else min(low, 5.0))
        return outcome

    def _record(self, listing, status, reason, *, fit: Fit | None = None, **values) -> Outcome:
        self.ledger.record(listing, status, reason=reason, **values)
        if reason and status not in (Status.APPLIED, Status.DRY_RUN):
            self.log(f"  {status.value}: {reason}")
        return Outcome(listing, status, reason, fit.line() if fit else None)


def _status_for(error: ApplierError) -> Status:
    """Return status from error helper."""
    from .errors import NotApplicableError

    if isinstance(error, NotApplicableError):
        return Status.UNAVAILABLE
    if error.terminal:
        return Status.UNCONFIRMED
    return Status.ERROR


def write_summary(summary: RunSummary, directory: Path) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    stamp = summary.started_at.replace(":", "").replace("-", "")
    path = directory / f"{stamp}.json"
    path.write_text(json.dumps(summary.as_dict(), indent=2, ensure_ascii=False))
    return path
