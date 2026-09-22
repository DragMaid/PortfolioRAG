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
    # The board hands off to the employer's site. Recorded and skipped.
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

    cover_letter: str
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
class Submission:
    """What a board reports back from an apply attempt."""

    submitted: bool
    answers: dict[str, Answer] = field(default_factory=dict)
    # Where the page was captured at the last step: the review page on a dry run.
    artifacts: Path | None = None
    # The form is filled and left sitting at its review page, in a tab nobody closed. Only
    # a person can settle it now, by submitting it themselves or saying they will not.
    handed_off: bool = False
