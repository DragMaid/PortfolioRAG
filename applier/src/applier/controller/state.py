"""The nouns the page works in: what a posting is doing, and what the run was told to do.

:class:`JobState` is the controller's own vocabulary, not the ledger's. The ledger records
what became of a posting for good, across runs; a job state also covers what is happening to
it *right now* — being fetched, waiting for a person, halfway through a form — which is the
part a table has to show and no durable record should carry. :func:`settled_as` is the one
place the two meet.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

from rag.schemas import Verdict

from ..ledger import Status
from ..models import Listing


class JobState(StrEnum):
    FOUND = "found"
    FETCHING = "fetching"
    ASSESSING = "assessing"
    # A fit, waiting for a person to pick it. Only reached with picking set to manual.
    PENDING = "pending"
    # Picked, waiting for a free application slot.
    QUEUED = "queued"
    WRITING = "writing"
    APPLYING = "applying"
    # The form's questions are answered and waiting to be approved.
    REVIEWING = "reviewing"
    # Filled, at its review page, in a tab of its own. Theirs to send.
    AWAITING_HUMAN = "awaiting_human"

    APPLIED = "applied"
    SKIPPED = "skipped"
    UNFIT = "unfit"
    EXCLUDED = "excluded"
    EXTERNAL = "external"
    UNAVAILABLE = "unavailable"
    NEEDS_INPUT = "needs_input"
    UNCONFIRMED = "unconfirmed"
    ERROR = "error"


DONE = {
    JobState.APPLIED,
    JobState.SKIPPED,
    JobState.UNFIT,
    JobState.EXCLUDED,
    JobState.EXTERNAL,
    JobState.UNAVAILABLE,
    JobState.NEEDS_INPUT,
    JobState.UNCONFIRMED,
    JobState.ERROR,
}

WAITING = {JobState.PENDING, JobState.REVIEWING, JobState.AWAITING_HUMAN}

_TO_STATUS = {
    JobState.APPLIED: Status.APPLIED,
    JobState.SKIPPED: Status.SKIPPED,
    JobState.UNFIT: Status.UNFIT,
    JobState.EXCLUDED: Status.EXCLUDED,
    JobState.EXTERNAL: Status.EXTERNAL,
    JobState.UNAVAILABLE: Status.UNAVAILABLE,
    JobState.NEEDS_INPUT: Status.NEEDS_INPUT,
    JobState.UNCONFIRMED: Status.UNCONFIRMED,
    JobState.ERROR: Status.ERROR,
    JobState.PENDING: Status.PENDING,
    JobState.AWAITING_HUMAN: Status.AWAITING_HUMAN,
}

_FROM_STATUS = {status: state for state, status in _TO_STATUS.items()}


def settled_as(state: JobState) -> Status | None:
    """The ledger status a state is worth writing down, or None while it is still in motion."""
    return _TO_STATUS.get(state)


def state_of(status: Status) -> JobState:
    """A state for a posting read back out of the ledger, for the table on a fresh start."""
    if status == Status.DRY_RUN:
        return JobState.SKIPPED

    if status == Status.SUBMITTING:
        return JobState.UNCONFIRMED

    return _FROM_STATUS.get(status, JobState.ERROR)


@dataclass(slots=True)
class Stage:
    """One step of one posting's passage, for the trail under its row."""

    name: str
    at: float = field(default_factory=time.time)
    detail: str | None = None
    elapsed: float | None = None


@dataclass(slots=True)
class Job:
    """One posting, as the table shows it. Only the session thread mutates one of these."""

    key: str
    board: str
    url: str
    title: str
    company: str | None = None
    location: str | None = None
    state: JobState = JobState.FOUND
    reason: str | None = None

    verdict: Verdict | None = None
    score: int | None = None
    headline: str | None = None
    missing_essentials: int = 0

    report: dict[str, Any] | None = None
    letter: str | None = None
    answers: dict[str, Any] = field(default_factory=dict)
    questions: list[str] = field(default_factory=list)
    # Employer questions waiting to be approved, while the state is REVIEWING.
    review: list[dict[str, Any]] = field(default_factory=list)

    stages: list[Stage] = field(default_factory=list)
    # The browser tab this posting owns, once it has one. Named for the posting, so a
    # controller restarted against the same browser finds the same tabs.
    tab: str | None = None
    tab_open: bool = False
    # From the ledger rather than this run: shown greyed, never acted on.
    historic: bool = False

    found_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    def enter(self, state: JobState, detail: str | None = None) -> None:
        now = time.time()
        if self.stages:
            self.stages[-1].elapsed = now - self.stages[-1].at
        self.stages.append(Stage(state.value, at=now, detail=detail))
        self.state = state
        self.reason = detail
        self.updated_at = now

    def as_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "board": self.board,
            "url": self.url,
            "title": self.title,
            "company": self.company,
            "location": self.location,
            "state": self.state.value,
            "reason": self.reason,
            "verdict": self.verdict,
            "score": self.score,
            "headline": self.headline,
            "missingEssentials": self.missing_essentials,
            "hasReport": self.report is not None,
            "hasLetter": bool(self.letter),
            "questions": list(self.questions),
            "review": list(self.review),
            "tab": self.tab,
            "tabOpen": self.tab_open,
            "historic": self.historic,
            "foundAt": self.found_at,
            "updatedAt": self.updated_at,
            "stages": [
                {"name": s.name, "at": s.at, "detail": s.detail, "elapsed": s.elapsed}
                for s in self.stages
            ],
        }


@dataclass
class RunSettings:
    """The toggles, and the policy numbers a session may hold against the file's.

    Overrides live here and only here: ``applier.yaml`` is read at startup and never written,
    so a session's thresholds are this run's, and the next run starts from the file again.
    """

    # False puts every posting that clears the policy into PENDING, for a person to pick.
    auto_pick: bool = True
    # False fills each form to its review page and hands it over instead of submitting.
    auto_submit: bool = True
    # True shows every employer question and its checked answer before the form is filled.
    review_answers: bool = False
    # Hand-offs a person may have open at once. Applying pauses at the cap rather than
    # burying them in tabs.
    max_open_handoffs: int = 5

    # Which of the file's searches this run uses, by their index in the config.
    searches: list[int] = field(default_factory=list)
    max_applications: int | None = None
    max_assessments: int | None = None
    min_verdict: Verdict | None = None
    min_score: int | None = None
    allow_missing_essentials: int | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "autoPick": self.auto_pick,
            "autoSubmit": self.auto_submit,
            "reviewAnswers": self.review_answers,
            "maxOpenHandoffs": self.max_open_handoffs,
            "searches": list(self.searches),
            "maxApplications": self.max_applications,
            "maxAssessments": self.max_assessments,
            "minVerdict": self.min_verdict,
            "minScore": self.min_score,
            "allowMissingEssentials": self.allow_missing_essentials,
        }


def listing_of(job: Job) -> Listing:
    board, _, job_id = job.key.partition(":")
    return Listing(
        board=board,
        job_id=job_id,
        url=job.url,
        title=job.title,
        company=job.company,
        location=job.location,
    )
