"""The controller's state machine, with a fake board and a fake browser.

No camoufox, no model, no network. What is being pinned down here is the bookkeeping around
the two decisions the controller gives back to a person, because that is where a double
application would come from:

* a posting bound for the manual queue is written to the ledger as ``manual``, which is
  terminal — no later run reopens it, and nothing automatic ever submits it;
* a link-out is assessed like any other posting, and only a fit reaches the queue;
* a closed browser costs one retry of one posting, never the run.
"""

from __future__ import annotations

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


class FakeBrowser:
    """Only the parts of BrowserSession the controller uses: one tab, healed on demand."""

    def __init__(self) -> None:
        self.closed = False
        self.ensured = 0
        self.gone = False
        self.relaunched = 0
        self.visited: list[str] = []

    def ensure(self) -> None:
        self.ensured += 1
        if self.gone:
            self.gone = False
            self.relaunched += 1

    def tidy(self) -> int:
        return 0

    @property
    def interrupted(self) -> bool:
        return self.gone

    def front(self) -> None:
        pass

    def goto(self, url: str) -> None:
        self.visited.append(url)

    # Hidden until a person is needed, as the real one is.
    hidden = True
    shown: tuple[str, ...] = ()

    @property
    def visible(self) -> bool:
        return bool(self.shown) and not self.settled_after

    settled_after = False

    def show(self, why: str) -> None:
        self.shown = (*self.shown, why)
        self.settled_after = False

    def settle(self) -> None:
        if self.hidden and self.shown:
            self.settled_after = True

    def close(self) -> None:
        self.closed = True


class FakeBoard:
    name = "fake"
    login_url = "https://fake/login"

    def __init__(self, listings: list[Listing]) -> None:
        self.listings = listings
        self.browser: FakeBrowser | None = None
        self.applied: list[str] = []
        self.method = ApplyMethod.QUICK
        # Postings whose next apply finds the window closed under it.
        self.slam: set[str] = set()
        self.signed_in = True
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
        return self.signed_in

    def ensure_signed_in(self) -> None:
        if not self.signed_in:
            from applier.errors import LoginRequiredError

            raise LoginRequiredError("signed out")

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
            apply_url=f"{listing.url}/apply",
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

        if posting.listing.key in self.slam:
            from applier.errors import BrowserClosedError

            self.slam.discard(posting.listing.key)
            if self.browser is not None:
                self.browser.gone = True
            raise BrowserClosedError("The job board's tab was closed.")

        # The answerer first, and only then the record: a real board fills a form once it
        # has answers, so an answerer that refuses must leave nothing behind here either.
        answers = context.answerer.answer(self.handles(), role=posting.title)
        self.applied.append(posting.listing.key)
        recorded = {"Notice period": "1 month"} | {str(k): v for k, v in answers.items()}
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
        return False


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
        session.answerer.answer = lambda handles, *, role, facts=None: {}  # type: ignore[method-assign]
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
    session, board, browser = make_session(2, autoPick=True, applyMode="auto")
    session.start()

    def both_applied() -> bool:
        seen = states(session)
        return len(seen) == 2 and all(state == "applied" for state in seen.values())

    wait_for(both_applied, "both postings should have been applied to")
    assert sorted(board.applied) == ["fake:0", "fake:1"]
    assert browser.ensured > 0, "every command checks the window is there first"
    assert session.ledger.get("fake:0").status is Status.APPLIED


def test_manual_picking_waits_for_you(make_session):
    session, board, _ = make_session(2, autoPick=False, applyMode="auto")
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


# --- the manual queue -------------------------------------------------------


def test_manual_mode_queues_every_fit_for_you_and_submits_nothing(make_session):
    session, board, _ = make_session(2, autoPick=True, applyMode="manual")
    session.start()

    wait_for(
        lambda: list(states(session).values()).count("manual") == 2,
        "both should be in the manual queue",
    )
    assert board.applied == [], "a board never fills a form bound for the manual queue"

    entry = session.ledger.get("fake:0")
    assert entry.status is Status.MANUAL
    assert entry.letter, "the letter is written ahead, for the extension to paste"
    assert entry.apply_url == "https://fake/job/0/apply"
    # Written before anything else can happen: no later run reopens it.
    assert Status.MANUAL in TERMINAL


def test_a_board_mode_overrides_the_default(make_session):
    session, board, _ = make_session(
        1, autoPick=True, applyMode="auto", boardModes={"fake": "manual"}
    )
    session.start()

    wait_for(lambda: state_at(session, "fake:0") == "manual", "the board's own mode wins")
    assert board.applied == []


def test_a_link_out_that_fits_goes_to_the_manual_queue(make_session):
    """Assessed like any other: whether it is worth applying to is not about whose form."""
    session, board, _ = make_session(1, autoPick=True, applyMode="auto")
    board.method = ApplyMethod.EXTERNAL
    session.start()

    wait_for(lambda: state_at(session, "fake:0") == "manual", "a fitting link-out is queued")
    assert board.applied == [], "and never submitted by the board"
    job = session.job("fake:0")
    assert job["external"] is True
    assert job["report"] is not None, "it was assessed"


def test_a_link_out_that_does_not_fit_is_unfit(make_session):
    session, board, _ = make_session(1, autoPick=True, minScore=95)
    session.assessor = FakeAssessor(score=60)  # type: ignore[assignment]
    board.method = ApplyMethod.EXTERNAL
    session.start()

    wait_for(lambda: state_at(session, "fake:0") == "unfit", "it is ruled out like any other")


def test_i_sent_it_settles_a_manual_posting(make_session):
    session, _, _ = make_session(1, autoPick=True, applyMode="manual")
    session.start()
    wait_for(lambda: state_at(session, "fake:0") == "manual", "it should be queued")

    session.mark_submitted("fake:0")

    assert state_at(session, "fake:0") == "applied"
    assert session.ledger.get("fake:0").status is Status.APPLIED


def test_the_manual_queue_comes_back_after_a_restart(make_session):
    session, _, _ = make_session(2, autoPick=True, applyMode="manual")
    session.start()
    wait_for(
        lambda: list(states(session).values()).count("manual") == 2, "both should be queued"
    )
    session.close()

    again, _, _ = make_session(0)
    assert set(states(again).values()) == {"manual"}
    again.mark_submitted("fake:1")
    assert again.ledger.get("fake:1").status is Status.APPLIED


def test_an_old_hand_off_is_read_back_into_the_manual_queue(make_session, tmp_path):
    """A form an older version left in a camoufox tab: still the person's to settle."""
    ledger = Ledger(tmp_path / "state" / "ledger.sqlite")
    ledger.record(listings(1)[0], Status.AWAITING_HUMAN, reason="filled in")
    ledger.close()

    session, _, _ = make_session(0)
    assert state_at(session, "fake:0") == "manual"


def test_the_manual_queue_is_not_held_back_by_the_application_limit(make_session):
    session, _, _ = make_session(3, autoPick=True, applyMode="manual", maxApplications=1)
    session.start()

    wait_for(
        lambda: list(states(session).values()).count("manual") == 3,
        "nothing was submitted, so nothing counts against the limit",
    )


# --- a closed browser ------------------------------------------------------


def test_closing_the_window_mid_application_retries_it_once(make_session):
    """The run carries on: the window is reopened and the posting tried again."""
    session, board, browser = make_session(2, autoPick=True, applyMode="auto")
    board.slam.add("fake:0")
    session.start()

    def both_applied() -> bool:
        seen = states(session)
        return len(seen) == 2 and all(state == "applied" for state in seen.values())

    wait_for(both_applied, "both should still be applied to")
    assert browser.relaunched == 1
    assert session.status()["stoppedBecause"] is None, "and the run was never stopped"


def test_a_tab_closed_mid_form_is_retried_whatever_error_it_surfaced_as(make_session):
    """Playwright reports a closed tab as whatever call was in flight, not as a closed tab."""
    from applier.errors import FlowError

    session, board, browser = make_session(1, autoPick=True, applyMode="auto")
    real_apply = board.apply
    calls = []

    def apply(posting, context):
        calls.append(posting.listing.key)
        if len(calls) == 1:
            browser.gone = True
            raise FlowError("The questions step failed: Target page has been closed")
        return real_apply(posting, context)

    board.apply = apply  # type: ignore[method-assign]
    session.start()

    wait_for(lambda: state_at(session, "fake:0") == "applied", "it should be retried and sent")
    assert len(calls) == 2


def test_a_submit_the_window_closed_on_is_never_retried(make_session):
    """After the click, whether it went is unknown: never a second application."""
    from applier.errors import FlowError

    session, board, browser = make_session(1, autoPick=True, applyMode="auto")

    def apply(posting, context):
        browser.gone = True
        error = FlowError("The submit click failed: Target page has been closed")
        error.terminal = True
        raise error

    board.apply = apply  # type: ignore[method-assign]
    session.start()

    wait_for(lambda: state_at(session, "fake:0") == "unconfirmed", "it is left for a person")
    assert session.ledger.get("fake:0").status is Status.UNCONFIRMED


def test_a_second_closed_window_on_the_same_posting_is_an_error_to_retry(make_session):
    session, board, _ = make_session(1, autoPick=True, applyMode="auto")
    session._interrupted.add("fake:0")  # it has already been cut off once
    board.slam.add("fake:0")
    session.start()

    wait_for(lambda: state_at(session, "fake:0") == "error", "it should be left to retry")
    assert session.ledger.get("fake:0").status not in TERMINAL


def test_stopping_releases_an_open_review(make_session):
    session, board, _ = make_session(1, autoPick=True, applyMode="auto", answers="always")
    session.answerer.answer = lambda handles, *, role, facts=None: {}  # type: ignore[method-assign]
    session.start()
    wait_for(lambda: state_at(session, "fake:0") == "reviewing", "it should stop to ask")

    session.stop()

    wait_for(lambda: state_at(session, "fake:0") == "skipped", "the review is discarded")
    assert board.applied == []


# --- the policy still decides ----------------------------------------------


def test_a_posting_below_the_threshold_never_reaches_a_form(make_session):
    session, board, _ = make_session(1, autoPick=True, applyMode="auto", minScore=95)
    session.assessor = FakeAssessor(score=60)  # type: ignore[assignment]
    session.start()

    wait_for(lambda: state_at(session, "fake:0") == "unfit", "it should be ruled out")
    assert board.applied == [], "an unfit posting is never opened for applying"
    assert session.ledger.get("fake:0").status is Status.UNFIT


def test_a_settled_posting_is_shown_but_never_touched_again(make_session, tmp_path):
    session, _board, _ = make_session(1, autoPick=True, applyMode="auto")
    session.start()
    wait_for(lambda: state_at(session, "fake:0") == "applied", "it should be applied to")
    session.close()

    # A second session, against the same ledger, finds it again.
    again, board_again, _ = make_session(1, autoPick=True, applyMode="auto")
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


def test_no_cover_letter_means_none_is_written_or_sent(make_session):
    session, board, _ = make_session(1, autoPick=True, applyMode="auto")
    session.update_profile({"includeLetter": False})
    written: list[str] = []
    session.assessor.letter = lambda *_: written.append("x") or "a letter"  # type: ignore[method-assign]
    sent: list[object] = []
    real_apply = board.apply

    def apply(posting, context):
        sent.append(context.packet.cover_letter)
        return real_apply(posting, context)

    board.apply = apply  # type: ignore[method-assign]
    session.start()

    wait_for(lambda: state_at(session, "fake:0") == "applied", "it should be applied to")
    assert written == [], "no letter is written"
    assert sent == [None], "and the board is told to leave it out"
    assert "cover_letter: false" in session.config.source_path.read_text()


# --- the end of a run -------------------------------------------------------


def test_a_run_ends_itself_when_everything_is_settled(make_session):
    session, _, _ = make_session(2, autoPick=True, applyMode="auto")
    session.start()

    wait_for(lambda: session.status()["running"] is False, "the run should end on its own")
    status = session.status()
    assert status["finished"] == "2 applied, 2 assessed"
    assert status["stoppedBecause"] is None
    assert set(states(session).values()) == {"applied"}


def test_a_run_ends_with_the_manual_queue_waiting_on_you(make_session):
    session, _, _ = make_session(2, autoPick=True, applyMode="manual")
    session.start()

    wait_for(lambda: session.status()["running"] is False, "nothing more for it to do")
    assert session.status()["finished"] == "0 applied, 2 assessed, 2 to send by hand"


def test_a_run_that_finds_nothing_new_ends_at_once(make_session):
    session, _, _ = make_session(0)
    session.start()
    wait_for(lambda: session.status()["running"] is False, "an empty search is a finished run")


def test_postings_over_the_application_limit_wait_to_be_picked(make_session):
    """Left queued, they would hold the run open forever."""
    session, board, _ = make_session(3, autoPick=True, applyMode="auto", maxApplications=1)
    session.start()

    wait_for(lambda: session.status()["running"] is False, "the run should still end")
    assert len(board.applied) == 1
    assert sorted(states(session).values()) == ["applied", "pending", "pending"]


def test_a_signed_out_board_brings_up_a_window_and_the_run_goes_on(make_session):
    import threading

    session, board, browser = make_session(1, autoPick=True, applyMode="auto")
    board.signed_in = False

    def person() -> None:
        wait_for(lambda: browser.shown, "a window should come up for the sign-in")
        board.signed_in = True

    helper = threading.Thread(target=person, daemon=True)
    helper.start()
    session.start()

    wait_for(lambda: state_at(session, "fake:0") == "applied", "the run carries on after")
    assert browser.shown == ("sign in to fake",)
    assert board.login_url in browser.visited
    assert browser.settled_after, "and the window goes away again"


# --- lanes ------------------------------------------------------------------


def test_workers_are_never_fewer_than_two(make_session):
    session, _, _ = make_session(0, workers=1)
    assert session.config.run.workers == 2
    assert "workers: 2" in session.config.source_path.read_text()


def test_assessing_goes_on_while_an_application_is_under_way(make_session):
    """Lane 0 only assesses, so a form being filled holds up nothing but itself."""
    import threading

    session, board, _ = make_session(3, autoPick=True, applyMode="auto")
    release = threading.Event()
    real_apply = board.apply

    def slow_apply(posting, context):
        release.wait(WAIT)
        return real_apply(posting, context)

    board.apply = slow_apply  # type: ignore[method-assign]
    session.start()

    def all_assessed() -> bool:
        seen = states(session)
        return len(seen) == 3 and "found" not in seen.values() and "fetching" not in seen.values()

    wait_for(all_assessed, "every posting is assessed while the first form waits")
    assert board.applied == [], "and the first form is still in hand"
    release.set()
    wait_for(lambda: len(board.applied) == 3, "then all three go")


def test_parallel_lanes_never_apply_past_the_limit(make_session):
    session, board, _ = make_session(4, autoPick=True, applyMode="auto", workers=4)
    session.update_settings({"maxApplications": 1})
    session.start()

    wait_for(lambda: session.status()["running"] is False, "the run should end")
    assert len(board.applied) == 1
    assert sorted(states(session).values()) == ["applied", "pending", "pending", "pending"]


def test_postings_over_the_assessment_limit_say_so_and_are_assessed_when_picked(make_session):
    session, board, _ = make_session(3, autoPick=True, applyMode="auto", maxAssessments=1)
    session.start()

    wait_for(lambda: session.status()["running"] is False, "the run should end")
    finished = session.status()["finished"]
    assert "2 not assessed (the limit of 1 assessments per run was reached)" in finished
    held = [job for job in session.jobs() if job["state"] == "pending"]
    assert len(held) == 2 and all("not assessed" in job["reason"] for job in held)

    session.approve(held[0]["key"])
    wait_for(lambda: state_at(session, held[0]["key"]) == "applied", "assessed, then sent")
    assert held[0]["key"] in board.applied


def test_picking_every_posting_over_the_application_limit_applies_to_all_of_them(make_session):
    """The limit holds the run back, never a person: each one pressed is sent."""
    session, board, _ = make_session(6, autoPick=True, applyMode="auto", maxApplications=2)
    session.start()
    wait_for(lambda: session.status()["running"] is False, "the run should end")
    held = [job["key"] for job in session.jobs() if job["state"] == "pending"]
    assert len(held) == 4

    for key in held:
        session.approve(key)
    wait_for(lambda: len(board.applied) == 6, "every picked posting is applied to")
    assert set(states(session).values()) == {"applied"}


def test_picking_past_both_limits_applies_to_every_one(make_session):
    """Assessed past one limit because a person asked, and sent past the other likewise."""
    session, board, _ = make_session(
        8, autoPick=True, applyMode="auto", workers=3, maxAssessments=2, maxApplications=3
    )
    session.start()
    wait_for(lambda: session.status()["running"] is False, "the run should end")
    held = [job["key"] for job in session.jobs() if job["state"] == "pending"]
    assert len(held) == 6

    for key in held:
        session.approve(key)
    wait_for(lambda: len(board.applied) == 8, "every picked posting is assessed and sent")
    assert set(states(session).values()) == {"applied"}


def test_a_search_that_fails_does_not_stop_the_run(make_session):
    session, board, _ = make_session(2, autoPick=True, applyMode="auto")
    found = board.listings

    def search(_search):
        yield found[0]
        raise TimeoutError()

    board.search = search  # type: ignore[method-assign]
    session.start()

    wait_for(lambda: session.status()["running"] is False, "the run ends on its own")
    assert session.status()["stoppedBecause"] is None
    assert state_at(session, "fake:0") == "applied"
    assert any("gave up part-way" in line["line"] for line in session.scrollback())


def test_stopping_says_what_was_left_and_start_picks_it_up(make_session):
    import threading

    session, board, _ = make_session(3, autoPick=True, applyMode="manual")
    gate = threading.Event()
    real_fetch = board.fetch

    def fetch(listing):
        gate.wait(WAIT)
        return real_fetch(listing)

    board.fetch = fetch  # type: ignore[method-assign]
    session.start()
    wait_for(lambda: len(states(session)) == 3, "all three found")
    session.stop("you pressed stop")
    gate.set()

    def nothing_moving() -> bool:
        seen = states(session).values()
        return "found" not in seen and "fetching" not in seen

    wait_for(nothing_moving, "nothing is left looking as if it were moving")
    assert "not assessed" in session.status()["stoppedBecause"]

    session.start()
    wait_for(lambda: set(states(session).values()) == {"manual"}, "a second start assesses them")


def test_the_chat_site_gets_a_tab_per_worker(make_session):
    session, _, _ = make_session(0, workers=3)
    assert session.config.llm.provider == "web"
    assert session.llm.tabs == 3 and session.llm.parallel

    session.update_settings({"workers": 5})
    assert session.llm.tabs == 5
    provider = session.llm.provider
    assert provider.tabs == 5  # type: ignore[union-attr]


def test_postings_the_assessment_limit_held_back_are_not_waiting_on_you(make_session):
    """Nobody has assessed them, so there is nothing yet for a person to decide."""
    session, _, _ = make_session(5, autoPick=True, applyMode="auto", maxAssessments=2)
    session.start()
    wait_for(lambda: session.status()["running"] is False, "the run should end")
    held = [job for job in session.jobs() if job["state"] == "pending" and not job["hasReport"]]
    assert len(held) == 3
    assert session.status()["waiting"] == 0
