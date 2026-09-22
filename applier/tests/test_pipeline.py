"""The run, with a fake board and a fake assessor: every decision, no browser, no model.

What has to hold is the bookkeeping — which postings reach the form, what the ledger says
afterwards, when the run stops — because that is where a double application or a runaway
run would come from.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from applier.assessment import Fit, PortfolioUnavailableError
from applier.config import Config
from applier.errors import FlowError, LoginRequiredError, UnanswerableError
from applier.ledger import Ledger, Status
from applier.models import ApplyMethod, Listing, Posting, Search, Submission
from applier.pipeline import ApplyPipeline, RunOptions


def listing(job_id: str, title: str = "Engineer") -> Listing:
    return Listing(board="fake", job_id=job_id, url=f"https://fake/job/{job_id}", title=title)


class FakeBoard:
    name = "fake"
    login_url = "https://fake/login"

    def __init__(self, listings, *, methods=None, apply_error=None):
        self.listings = listings
        self.methods = methods or {}
        self.apply_error = apply_error
        self.applied: list[tuple[str, bool]] = []
        self.signed_in = True

    def attach(self, _browser):
        pass

    def is_signed_in(self, *, navigate=True):
        return self.signed_in

    def ensure_signed_in(self):
        if not self.signed_in:
            raise LoginRequiredError("signed out")

    def search(self, _search):
        yield from self.listings

    def listing_for(self, url):
        return listing(url.rsplit("/", 1)[-1])

    def fetch(self, item):
        return Posting(
            listing=item,
            description="Build services in Python.",
            method=self.methods.get(item.job_id, ApplyMethod.QUICK),
            title=item.title,
            company="Acme",
        )

    def apply(self, posting, context):
        if self.apply_error:
            raise self.apply_error
        self.applied.append((posting.listing.job_id, context.submit))
        assert context.packet.cover_letter == "Dear Acme"
        return Submission(submitted=context.submit, answers={"Notice?": "1 month"})


class FakeAssessor:
    def __init__(self, fits: dict[str, tuple[str, int]], error=None):
        self.fits = fits
        self.error = error
        self.assessed: list[str] = []
        self.letters = 0

    def fit(self, text):
        if self.error:
            raise self.error
        job = next(key for key in self.fits if key in text) if self.fits else None
        verdict, score = self.fits.get(job, ("strong", 90))
        self.assessed.append(job)
        return Fit({"verdict": verdict, "score": score, "requirements": [], "headline": "ok"})

    def letter(self, _text, _notes):
        self.letters += 1
        return "Dear Acme"


def make(tmp_path: Path, board: FakeBoard, assessor: FakeAssessor, **policy) -> ApplyPipeline:
    config = Config.model_validate(
        {
            "searches": [{"board": "fake", "keywords": "python"}],
            "candidate": {"name": "Ada"},
            "policy": {"delay_seconds": [0, 0]} | policy,
        }
    )
    return ApplyPipeline(
        config,
        boards={"fake": board},
        assessor=assessor,  # type: ignore[arg-type]
        answerer=None,  # type: ignore[arg-type]
        ledger=Ledger(tmp_path / "ledger.sqlite"),
        log=lambda _: None,
        sleep=lambda _: None,
    )


SEARCH = [Search(board="fake", keywords="python")]


def statuses(pipeline: ApplyPipeline) -> dict[str, str]:
    return {e.key.split(":")[1]: e.status.value for e in pipeline.ledger.entries(limit=100)}


def titled(*pairs):
    return [listing(job_id, title) for job_id, title in pairs]


def test_a_fit_is_applied_to_and_a_poor_fit_is_not(tmp_path):
    board = FakeBoard(titled(("1", "Engineer one"), ("2", "Engineer two")))
    assessor = FakeAssessor({"Engineer one": ("strong", 90), "Engineer two": ("partial", 45)})
    pipeline = make(tmp_path, board, assessor)

    summary = pipeline.run(SEARCH, RunOptions())

    assert board.applied == [("1", True)]
    assert statuses(pipeline) == {"1": "applied", "2": "unfit"}
    assert summary.counts() == {"applied": 1, "unfit": 1}
    assert assessor.letters == 1  # no letter is written for a posting that is not applied to


def test_nothing_settled_is_opened_twice(tmp_path):
    board = FakeBoard(titled(("1", "Engineer one")))
    assessor = FakeAssessor({})
    make(tmp_path, board, assessor).run(SEARCH, RunOptions())

    again = make(tmp_path, board, assessor)
    summary = again.run(SEARCH, RunOptions())

    assert board.applied == [("1", True)]
    assert assessor.assessed == [None]
    assert summary.counts() == {"seen": 1}


def test_excluded_external_and_unavailable_are_never_assessed(tmp_path):
    board = FakeBoard(
        titled(("1", "Software Intern"), ("2", "Engineer"), ("3", "Engineer")),
        methods={"2": ApplyMethod.EXTERNAL, "3": ApplyMethod.UNAVAILABLE},
    )
    assessor = FakeAssessor({})
    pipeline = make(tmp_path, board, assessor, skip_titles=[r"\bintern\b"])

    pipeline.run(SEARCH, RunOptions())

    assert assessor.assessed == []
    assert statuses(pipeline) == {"1": "excluded", "2": "external", "3": "unavailable"}


def test_a_dry_run_submits_nothing_and_a_real_run_still_applies_later(tmp_path):
    board = FakeBoard(titled(("1", "Engineer")))
    assessor = FakeAssessor({})

    make(tmp_path, board, assessor).run(SEARCH, RunOptions(submit=False))
    assert board.applied == [("1", False)]

    pipeline = make(tmp_path, board, assessor)
    pipeline.run(SEARCH, RunOptions())

    assert board.applied == [("1", False), ("1", True)]
    assert statuses(pipeline) == {"1": "applied"}
    assert len(assessor.assessed) == 1  # the dry run's report was reused


def test_the_application_limit_stops_the_run_before_assessing_more(tmp_path):
    board = FakeBoard(titled(("1", "Engineer a"), ("2", "Engineer b"), ("3", "Engineer c")))
    assessor = FakeAssessor({})
    pipeline = make(tmp_path, board, assessor, max_applications=1)

    summary = pipeline.run(SEARCH, RunOptions())

    assert board.applied == [("1", True)]
    assert len(assessor.assessed) == 1
    assert "limit" in summary.stopped


def test_an_unanswerable_question_is_recorded_and_retried_on_request(tmp_path):
    board = FakeBoard(titled(("1", "Engineer")), apply_error=UnanswerableError(["Visa?"]))
    assessor = FakeAssessor({})
    pipeline = make(tmp_path, board, assessor)
    pipeline.run(SEARCH, RunOptions())

    entry = pipeline.ledger.get("fake:1")
    assert entry.status == Status.NEEDS_INPUT
    assert entry.questions == ["Visa?"]

    board.apply_error = None
    make(tmp_path, board, assessor).run(SEARCH, RunOptions())
    assert board.applied == []

    make(tmp_path, board, assessor).run(SEARCH, RunOptions(retry_skipped=True))
    assert board.applied == [("1", True)]
    assert assessor.letters == 1  # the letter was kept from the first attempt


def test_a_failure_after_the_submit_click_is_never_retried(tmp_path):
    error = FlowError("browser died mid-submit")
    error.terminal = True
    board = FakeBoard(titled(("1", "Engineer")), apply_error=error)
    pipeline = make(tmp_path, board, FakeAssessor({}))

    pipeline.run(SEARCH, RunOptions())
    assert statuses(pipeline) == {"1": "unconfirmed"}
    assert pipeline.ledger.should_skip("fake:1", retry_skipped=True) == Status.UNCONFIRMED


def test_a_process_dying_mid_submit_leaves_the_posting_settled(tmp_path):
    board = FakeBoard(titled(("1", "Engineer")), apply_error=KeyboardInterrupt())
    pipeline = make(tmp_path, board, FakeAssessor({}))

    with pytest.raises(KeyboardInterrupt):
        pipeline.run(SEARCH, RunOptions())

    assert statuses(pipeline) == {"1": "submitting"}
    assert pipeline.ledger.should_skip("fake:1", retry_skipped=True) == Status.SUBMITTING


def test_a_form_error_before_submitting_is_retried(tmp_path):
    board = FakeBoard(titled(("1", "Engineer")), apply_error=FlowError("selector rotted"))
    pipeline = make(tmp_path, board, FakeAssessor({}))

    pipeline.run(SEARCH, RunOptions())
    assert statuses(pipeline) == {"1": "error"}
    assert pipeline.ledger.should_skip("fake:1", retry_skipped=False) is None


def test_a_fatal_error_stops_the_run(tmp_path):
    board = FakeBoard(titled(("1", "Engineer a"), ("2", "Engineer b")))
    assessor = FakeAssessor({}, error=PortfolioUnavailableError("API is down"))
    pipeline = make(tmp_path, board, assessor)

    summary = pipeline.run(SEARCH, RunOptions())

    assert "API is down" in summary.stopped
    assert statuses(pipeline) == {"1": "error"}


def test_a_signed_out_board_stops_before_anything(tmp_path):
    board = FakeBoard(titled(("1", "Engineer")))
    board.signed_in = False
    pipeline = make(tmp_path, board, FakeAssessor({}))

    summary = pipeline.run(SEARCH, RunOptions())

    assert "signed out" in summary.stopped
    assert statuses(pipeline) == {}


def test_ignore_fit_applies_regardless(tmp_path):
    board = FakeBoard(titled(("1", "Engineer")))
    pipeline = make(tmp_path, board, FakeAssessor({"Engineer": ("weak", 10)}))

    outcome = pipeline.process(board, listing("1", "Engineer"), RunOptions(ignore_fit=True))
    assert outcome.status == Status.APPLIED
