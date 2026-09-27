"""The nouns shared between the pipeline and the boards."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from pathlib import Path
from typing import Any, Literal


@dataclass(frozen=True, slots=True)
class Search:
    """One configured search, handed to a board as-is. Boards ignore what they cannot use."""

    board: str
    keywords: str = ""
    location: str | None = None
    date_range: int | None = None
    url: str | None = None
    max_pages: int = 2


@dataclass(frozen=True, slots=True)
class Listing:
    """A search result: enough to dedupe and triage without opening the posting."""

    board: str
    job_id: str
    url: str
    title: str
    company: str | None = None
    location: str | None = None

    @property
    def key(self) -> str:
        return f"{self.board}:{self.job_id}"


class ApplyMethod(StrEnum):
    # Applied through the board's own form, which is the only kind this can submit.
    QUICK = "quick"
    # The board hands off to the employer's site. Assessed like any other posting, and a fit
    # goes to the manual queue for the browser extension to fill.
    EXTERNAL = "external"
    # Expired, already applied, or no apply button at all.
    UNAVAILABLE = "unavailable"


@dataclass(slots=True)
class Posting:
    listing: Listing
    description: str
    method: ApplyMethod
    title: str = ""
    company: str | None = None
    reason: str | None = None
    # Where a person should go to apply by hand: the board's own apply flow, or the posting
    # page whose button links out to the employer. Opened in the person's own browser.
    apply_url: str | None = None

    @property
    def text(self) -> str:
        """The posting as the rag pipelines read it: title and company first, as a human would."""
        head = [self.title or self.listing.title]
        if company := self.company or self.listing.company:
            head.append(company)
        return " — ".join(head) + "\n\n" + self.description


@dataclass(slots=True)
class Resume:
    """Which resume goes with an application.

    ``select`` picks one already stored on the board by (part of) its name; ``upload`` sends
    a file. Neither means whatever the board preselects, which is usually the latest one.
    """

    select: str | None = None
    upload: Path | None = None


@dataclass(slots=True)
class Packet:
    """Everything an application carries apart from the answers to employer questions."""

    # None leaves the letter out: the board's "Don't include a cover letter".
    cover_letter: str | None
    resume: Resume


FieldKind = Literal["text", "textarea", "number", "select", "radio", "checkbox", "date", "file"]


@dataclass(slots=True)
class FormField:
    """One question on a form, whatever control the board used to ask it."""

    id: str
    kind: FieldKind
    label: str
    required: bool = False
    options: list[str] = field(default_factory=list)
    current: str | list[str] | None = None
    max_length: int | None = None

    def describe(self) -> dict[str, Any]:
        """The field as the answering model sees it."""
        data: dict[str, Any] = {"id": self.id, "type": self.kind, "question": self.label}
        if self.required:
            data["required"] = True
        if self.options:
            data["options"] = self.options
        if self.current:
            data["current_value"] = self.current
        if self.max_length:
            data["max_length"] = self.max_length
        return data


Answer = str | list[str]


@dataclass(slots=True)
class Probe:
    """What a mock application found, without answering or sending anything.

    The setup run's whole product. It is how somebody gets a working profile without being
    asked to imagine, in advance, what an employer might want to know: the form is walked as
    far as its questions and then abandoned, and what it asked for becomes the list you fill
    in. ``resumes`` is the same trick for the resume — the names already on the board profile,
    read off the page, rather than a filename typed from memory.
    """

    questions: list[FormField] = field(default_factory=list)
    resumes: list[str] = field(default_factory=list)
    role: str = ""
    company: str | None = None
    url: str = ""


@dataclass(slots=True)
class Submission:
    """What a board reports back from an apply attempt."""

    submitted: bool
    answers: dict[str, Answer] = field(default_factory=dict)
    # Where the page was captured at the last step: the review page on a dry run.
    artifacts: Path | None = None
    # What a probing run found. Set only when ``ApplyContext.probe`` asked for one.
    probe: Probe | None = None
