"""The controller's state machine, with a fake board and a fake browser.

No camoufox, no model, no network. What is being pinned down here is the bookkeeping around
the two decisions the controller gives back to a person, because that is where a double
application would come from:

* a posting handed over is written to the ledger as ``awaiting_human`` **before** anyone can
  touch it, and ``awaiting_human`` is terminal — no later run reopens it;
* a tab the person closed without the board confirming anything is ``unconfirmed``, never
  retried, and never quietly counted as applied;
* the hand-off cap actually holds the queue back, so a walk-away run cannot bury someone in
  forty half-filled forms.
"""

from __future__ import annotations

import contextlib
import time
from pathlib import Path

import pytest

from applier.assessment import Fit
from applier.config import load
from applier.controller import JobState, Session
from applier.controller.state import DONE
from applier.forms import FieldHandle
from applier.ledger import TERMINAL, Ledger, Status
from applier.models import ApplyMethod, FormField, Listing, Posting, Probe, Submission

WAIT = 10.0


# --- fakes ------------------------------------------------------------------


class FakePage:
    def __init__(self) -> None:
        self.closed = False

    def is_closed(self) -> bool:
        return self.closed

    def close(self) -> None:
        self.closed = True

    def bring_to_front(self) -> None:
        pass


class FakeBrowser:
    """Only the parts of BrowserSession the controller uses: named tabs, focus and reaping."""

    def __init__(self) -> None:
        self.pages: dict[str, FakePage] = {}
        self.focused: list[str] = []
        self.closed = False
        self.reaped = 0

    @property
    def tabs(self) -> list[str]:
        for name in [name for name, page in self.pages.items() if page.is_closed()]:
            del self.pages[name]
        return list(self.pages)

    def open_tab(self, name: str) -> FakePage:
        page = self.pages.get(name)
        if page is None or page.is_closed():
            page = self.pages[name] = FakePage()
        return page

    def has_tab(self, name: str) -> bool:
        return name in self.tabs

    @contextlib.contextmanager
    def on(self, name: str | None):
        yield self.open_tab(name) if name else None

    def focus(self, name: str) -> bool:
        if name not in self.tabs:
            return False
        self.focused.append(name)
        return True

    def close_tab(self, name: str) -> None:
        page = self.pages.pop(name, None)
        if page is not None:
            page.close()

    def focus_working(self) -> bool:
        self.focused.append("")
        return True

    def reap(self) -> int:
        """Nothing opens tabs behind this one's back, so there is never anything to close."""
        self.reaped += 1
        return 0

    def close(self) -> None:
        self.closed = True


class FakeBoard:
    name = "fake"
    login_url = "https://fake/login"

    def __init__(self, listings: list[Listing]) -> None:
        self.listings = listings
        self.browser: FakeBrowser | None = None
        self.applied: list[str] = []
        self.sent: set[str] = set()
        self.method = ApplyMethod.QUICK
        # What a probing run finds on this employer's form.
        self.asks: list[FormField] = [
            FormField(id="q1", kind="number", label="Expected monthly salary (SGD)", required=True),
            FormField(
                id="q2",
                kind="radio",
                label="Do you have a valid driving licence?",
                options=["Yes", "No"],
            ),
        ]

    def attach(self, browser) -> None:
        self.browser = browser

    def is_signed_in(self, *, navigate: bool = True) -> bool:
        return True

    def ensure_signed_in(self) -> None:
        pass

    def search(self, _search):
        yield from self.listings

    def listing_for(self, url: str) -> Listing:
        return self.listings[0]

    def fetch(self, listing: Listing) -> Posting:
        return Posting(
            listing=listing,
            description="Build services in Python, at some length so it reads like a posting.",
            method=self.method,
            title=listing.title,
            company="Acme",
        )

    def apply(self, posting: Posting, context) -> Submission:
        if context.probe:
            # A mock application: what this employer asks, and nothing answered or sent.
            return Submission(
                submitted=False,
                probe=Probe(
                    questions=list(self.asks),
                    resumes=["Resume_2026.pdf", "Resume_old.pdf"],
                    role=posting.title,
                    company=posting.company,
                    url=posting.listing.url,
                ),
            )

        # The answerer first, and only then the record: a real board fills a form once it
        # has answers, so an answerer that refuses must leave nothing behind here either.
        answers = context.answerer.answer(self.handles(), role=posting.title)
        self.applied.append(posting.listing.key)
        recorded = {"Notice period": "1 month"} | {str(k): v for k, v in answers.items()}
        if context.hand_off:
            return Submission(submitted=False, answers=recorded, handed_off=True)
        return Submission(submitted=True, answers=recorded)

    def handles(self) -> list[FieldHandle]:
        return [
            FieldHandle(
                {
                    "id": found.id,
                    "kind": found.kind,
                    "label": found.label,
                    "required": found.required,
                    "options": list(found.options),
                }
            )
            for found in self.asks
        ]

    def submitted(self) -> bool:
        """True once the test says the person sent whatever tab is in front of us."""
        return bool(self.browser and set(self.browser.tabs) & self.sent)


class FakeAssessor:
    """A fit good enough to clear any policy, with no model behind it."""

    def __init__(self, score: int = 90, api: str = "") -> None:
        self.score = score
        # The two the page can change under a running session, kept here so that the
        # server's tests can see one arrive without a portfolio to arrive from.
        self.api = api
        self.token = ""

    def fit(self, _text: str) -> Fit:
        return Fit(
            {
                "verdict": "strong",
                "score": self.score,
                "headline": "A fit.",
                "summary": "",
                "requirements": [],
                "strengths": [],
                "gaps": [],
            }
        )

    def letter(self, _text: str, _notes) -> str:
        return "Dear hiring manager, …"


# --- fixtures ---------------------------------------------------------------


def write_config(where: Path) -> Path:
    """A real config file, because the controller writes to one now.

    Every toggle and threshold the page changes is saved back here, so a fixture that handed
    the session a config with nowhere to go would test a different thing from the one that
    runs.
    """
    path = where / "applier.yaml"
    if not path.is_file():
        path.write_text(
            "searches:\n"
            "  - board: fake\n"
            "    keywords: python\n"
            "candidate:\n"
            "  name: Tester\n"
            "  facts:\n"
            '    Notice period: "1 month"\n'
            "policy:\n"
            "  delay_seconds: [0, 0]\n"
            "state_dir: state\n",
            encoding="utf-8",
        )
    return path


def listings(count: int) -> list[Listing]:
    return [
        Listing(
            board="fake",
            job_id=str(index),
            url=f"https://fake/job/{index}",
            title=f"Role {index}",
        )
        for index in range(count)
    ]


@pytest.fixture
def make_session(tmp_path, monkeypatch):
    monkeypatch.setenv("APPLIER_PORTFOLIO_TOKEN", "pfl_test")
    made: list[Session] = []

    def build(count: int = 2, **settings) -> tuple[Session, FakeBoard, FakeBrowser]:
        board = FakeBoard(listings(count))
        browser = FakeBrowser()
        config = load(write_config(tmp_path))
        session = Session(
            config,
            headless=True,
            make_board=lambda _name: board,
            make_browser=lambda _name: browser,
        )
        session.assessor = FakeAssessor()  # type: ignore[assignment]
        session.answerer.answer = lambda handles, *, role: {}  # type: ignore[method-assign]
        session.update_settings({"searches": [0], **settings})
        made.append(session)
        return session, board, browser

    yield build

    for session in made:
        session.close()


def wait_for(check, message: str, timeout: float = WAIT) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if check():
            return
        time.sleep(0.05)
    raise AssertionError(message)


def states(session: Session) -> dict[str, str]:
    return {job["key"]: job["state"] for job in session.jobs()}


def state_at(session: Session, key: str) -> str | None:
    """A row's state, or None while the search has not turned it up yet."""
    return states(session).get(key)


# --- the run ----------------------------------------------------------------


def test_everything_on_applies_without_asking(make_session):
    session, board, browser = make_session(2, autoPick=True, autoSubmit=True)
    session.start()

    def both_applied() -> bool:
        seen = states(session)
        return len(seen) == 2 and all(state == "applied" for state in seen.values())

    wait_for(both_applied, "both postings should have been applied to")
    assert sorted(board.applied) == ["fake:0", "fake:1"]
    # A submitted application leaves no tab behind.
    assert browser.tabs == []
    assert session.ledger.get("fake:0").status is Status.APPLIED


def test_manual_picking_waits_for_you(make_session):
    session, board, _ = make_session(2, autoPick=False, autoSubmit=True)
    session.start()

    wait_for(
        lambda: list(states(session).values()).count("pending") == 2,
        "both postings should be waiting to be picked",
    )
    assert board.applied == [], "nothing may be applied to before it is picked"
    # The shortlist is on record, so closing the controller does not lose it.
    assert session.ledger.get("fake:0").status is Status.PENDING

    session.approve("fake:0")
    wait_for(
        lambda: state_at(session, "fake:0") == "applied", "the picked one should be applied to"
    )
    assert board.applied == ["fake:0"]
    assert state_at(session, "fake:1") == "pending", "the one you did not pick stays where it was"


def test_skipping_a_pending_posting_settles_it(make_session):
    session, board, _ = make_session(1, autoPick=False)
    session.start()
    wait_for(lambda: state_at(session, "fake:0") == "pending", "it should be waiting to be picked")

    session.skip("fake:0")

    assert state_at(session, "fake:0") == "skipped"
    assert session.ledger.get("fake:0").status is Status.SKIPPED
    assert Status.SKIPPED in TERMINAL, "a posting you passed on must never be offered again"
    assert board.applied == []


# --- handing over -----------------------------------------------------------


def test_an_application_that_is_sent_needs_no_tab_of_its_own(make_session):
    """Only a form left standing gets its own tab.

    A run that submits for you opens and closes a tab per posting, and every one of them is
    in front of the person for as long as it takes to fill a form. There is nothing in them
    to read — the thing worth watching is the working tab, which is where it now happens.
    """
    session, board, browser = make_session(1, autoPick=True, autoSubmit=True)
    session.start()
    wait_for(lambda: state_at(session, "fake:0") == "applied", "it should be applied to")

    assert board.applied == ["fake:0"], "and the form was filled all the same"
    assert browser.tabs == [], "with no tab of its own opened for it"
    assert session._jobs["fake:0"].tab == ""


def test_hand_off_leaves_the_tab_open_and_records_it_first(make_session):
    session, _board, browser = make_session(1, autoPick=True, autoSubmit=False)
    session.start()

    wait_for(
        lambda: state_at(session, "fake:0") == "awaiting_human",
        "it should be filled in and handed over",
    )

    assert browser.has_tab("fake:0"), "the tab it was filled in is left open for you"
    assert "fake:0" in browser.focused, "and brought to the front"
    # Written before you can do anything with it: whatever happens next, no run reopens it.
    assert session.ledger.get("fake:0").status is Status.AWAITING_HUMAN
    assert Status.AWAITING_HUMAN in TERMINAL


def test_submitting_it_yourself_is_noticed(make_session):
    session, board, browser = make_session(1, autoPick=True, autoSubmit=False)
    session.start()
    wait_for(lambda: state_at(session, "fake:0") == "awaiting_human", "it should be handed over")

    # The person reads the review page and presses submit; the board's own confirmation shows.
    board.sent.add("fake:0")

    wait_for(lambda: state_at(session, "fake:0") == "applied", "the watcher should notice it went")
    assert session.ledger.get("fake:0").status is Status.APPLIED
    assert not browser.has_tab("fake:0"), "a settled hand-off closes its tab"


def test_i_sent_it_settles_a_hand_off_by_hand(make_session):
    session, _, browser = make_session(1, autoPick=True, autoSubmit=False)
    session.start()
    wait_for(lambda: state_at(session, "fake:0") == "awaiting_human", "it should be handed over")

    session.mark_submitted("fake:0")

    assert state_at(session, "fake:0") == "applied"
    assert session.ledger.get("fake:0").status is Status.APPLIED
    wait_for(lambda: not browser.has_tab("fake:0"), "its tab should be closed")


def test_closing_the_tab_yourself_is_unconfirmed_not_applied(make_session):
    """The one case that must never guess. Nobody knows whether it went, so nobody says."""
    session, _, browser = make_session(1, autoPick=True, autoSubmit=False)
    session.start()
    wait_for(lambda: state_at(session, "fake:0") == "awaiting_human", "it should be handed over")

    browser.close_tab("fake:0")

    wait_for(
        lambda: state_at(session, "fake:0") == "unconfirmed",
        "a tab closed without a confirmation is unconfirmed",
    )
    assert session.ledger.get("fake:0").status is Status.UNCONFIRMED
    assert Status.UNCONFIRMED in TERMINAL, "it must never be retried into a second application"


def test_the_hand_off_cap_holds_the_queue_back(make_session):
    session, board, _ = make_session(4, autoPick=True, autoSubmit=False, maxOpenHandoffs=2)
    session.start()

    wait_for(
        lambda: list(states(session).values()).count("awaiting_human") == 2,
        "two should be handed over",
    )
    time.sleep(0.5)  # give the queue a chance to misbehave

    assert list(states(session).values()).count("awaiting_human") == 2, "the cap should hold"
    assert len(board.applied) == 2
    assert session.status()["handoffCapReached"] is True

    # Resolving one lets exactly one more through.
    session.mark_submitted(next(k for k, v in states(session).items() if v == "awaiting_human"))
    wait_for(lambda: len(board.applied) == 3, "resolving one should release one")


# --- the policy still decides ----------------------------------------------


def test_a_posting_below_the_threshold_never_reaches_a_form(make_session):
    session, board, _ = make_session(1, autoPick=True, autoSubmit=True, minScore=95)
    session.assessor = FakeAssessor(score=60)  # type: ignore[assignment]
    session.start()

    wait_for(lambda: state_at(session, "fake:0") == "unfit", "it should be ruled out")
    assert board.applied == [], "an unfit posting is never opened for applying"
    assert session.ledger.get("fake:0").status is Status.UNFIT


def test_a_link_out_is_recorded_and_left_alone(make_session):
    session, board, _ = make_session(1)
    board.method = ApplyMethod.EXTERNAL
    session.start()

    wait_for(lambda: state_at(session, "fake:0") == "external", "it should be recorded as external")
    assert board.applied == []


def test_a_settled_posting_is_shown_but_never_touched_again(make_session, tmp_path):
    session, _board, _ = make_session(1, autoPick=True, autoSubmit=True)
    session.start()
    wait_for(lambda: state_at(session, "fake:0") == "applied", "it should be applied to")
    session.close()

    # A second session, against the same ledger, finds it again.
    again, board_again, _ = make_session(1, autoPick=True, autoSubmit=True)
    again.start()

    wait_for(lambda: "fake:0" in states(again), "it should turn up in the search again")
    time.sleep(0.4)
    assert state_at(again, "fake:0") == "applied"
    assert board_again.applied == [], "an applied posting is never applied to twice"


def test_every_done_state_is_one_the_ledger_can_hold(make_session):
    """The table's vocabulary and the ledger's have to line up, or a row settles into nothing."""
    from applier.controller.state import settled_as

    for state in DONE:
        assert settled_as(JobState(state)) is not None, f"{state} has nowhere to be recorded"


# --- the shortlist survives a restart ---------------------------------------


def test_a_shortlist_comes_back_after_a_restart(make_session):
    session, _, _ = make_session(2, autoPick=False)
    session.start()
    wait_for(
        lambda: list(states(session).values()).count("pending") == 2,
        "both should be waiting to be picked",
    )
    session.close()

    again, _, _ = make_session(0, autoPick=False)
    assert sorted(states(again)) == ["fake:0", "fake:1"]
    assert set(states(again).values()) == {"pending"}


def test_the_ledger_migrates_an_older_database(tmp_path):
    """The new statuses are values, not columns: an existing ledger opens untouched."""
    path = tmp_path / "ledger.sqlite"
    first = Ledger(path)
    first.record(listings(1)[0], Status.APPLIED, reason="from an older run")
    first.close()

    second = Ledger(path)
    try:
        entry = second.get("fake:0")
        assert entry is not None and entry.status is Status.APPLIED
        second.settle("fake:0", Status.UNCONFIRMED, reason="checked by hand")
        assert second.get("fake:0").status is Status.UNCONFIRMED
    finally:
        second.close()
