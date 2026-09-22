"""The contract between the pipeline and a job board.

A board does four things, and the pipeline does everything else — deduping, assessing,
deciding, writing, recording:

    search(search)          -> the listings a search turns up, lazily, page by page
    fetch(listing)          -> the posting: its text, and whether it can be applied to here
    apply(posting, context) -> fill the board's form and submit it (or stop short: on a dry
                               run, at a hand-off, or at a probe — see ApplyContext)
    ensure_signed_in()      -> raise LoginRequiredError unless the profile is signed in
    submitted()             -> whether the page in front of it shows a sent application

A board is handed an open :class:`BrowserSession` and never opens its own, so the pipeline
decides the profile, headlessness and where captures go.

Anything ``apply`` raises after its submit click must be marked ``terminal``: the pipeline
then records the posting as unconfirmed and never retries it, because applying twice to the
same employer is the one mistake here that cannot be taken back.

``apply`` gets everything as values and one callback: the answerer, which it calls with the
questions it found on its form. It never sees the policy, the model or the ledger.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from ..answering import AnswerProvider
from ..browser import BrowserSession
from ..models import Listing, Packet, Posting, Search, Submission


@dataclass(slots=True)
class ApplyContext:
    packet: Packet
    answerer: AnswerProvider
    # False stops at the final review, with the page captured, and submits nothing.
    submit: bool
    # Save every step's page, not only the last one or a failure.
    capture_steps: bool = False
    # With ``submit`` false: leave the review page exactly as it is, on screen, for a person
    # to read and send themselves. The adapter returns ``Submission(handed_off=True)`` and
    # must not navigate away — the page it stops on is the whole of what is handed over.
    hand_off: bool = False
    # A mock application: walk as far as the questions, report them, and stop. Nothing is
    # answered, nothing is continued past that step, and nothing is ever sent. The adapter
    # returns ``Submission(probe=Probe(...))`` carrying the questions it found and the names
    # of the resumes on the profile. This is what setup runs, so that a profile is built from
    # a form a real employer wrote rather than from guesses about what they might ask.
    probe: bool = False


@runtime_checkable
class JobBoard(Protocol):
    name: str
    # Where `applier login` sends the browser.
    login_url: str

    def attach(self, browser: BrowserSession) -> None:
        """Hands the board its browser. Called once, before anything else."""
        ...

    def ensure_signed_in(self) -> None: ...

    def is_signed_in(self, *, navigate: bool = True) -> bool:
        """Whether the profile is signed in. ``navigate=False`` only reads the current page,
        for polling while a person is signing in without dragging the page away."""
        ...

    def search(self, search: Search) -> Iterator[Listing]: ...

    def fetch(self, listing: Listing) -> Posting: ...

    def listing_for(self, url: str) -> Listing:
        """A listing from a posting URL, for applying to one posting by hand."""
        ...

    def apply(self, posting: Posting, context: ApplyContext) -> Submission: ...

    def submitted(self) -> bool:
        """Whether the page the board is pointed at shows a sent application.

        Read-only, and safe to call at any time against a tab a person is using. It is how a
        hand-off settles itself: the controller looks at each open tab between commands, and
        a true here records the application without anyone having to press anything.
        """
        ...
