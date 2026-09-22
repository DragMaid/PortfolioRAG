from __future__ import annotations

from pathlib import Path

from applier.ledger import Ledger, Status
from applier.models import Listing

LISTING = Listing(board="jobstreet", job_id="1", url="https://x/job/1", title="Engineer")


def test_terminal_statuses_are_never_reopened(tmp_path: Path):
    ledger = Ledger(tmp_path / "l.sqlite")

    assert ledger.should_skip(LISTING.key, retry_skipped=False) is None

    for status in (Status.APPLIED, Status.SUBMITTING, Status.UNCONFIRMED, Status.UNFIT):
        ledger.record(LISTING, status)
        assert ledger.should_skip(LISTING.key, retry_skipped=True) == status


def test_needs_input_waits_for_retry_skipped(tmp_path: Path):
    ledger = Ledger(tmp_path / "l.sqlite")
    ledger.record(LISTING, Status.NEEDS_INPUT, questions=["Notice period?"])

    assert ledger.should_skip(LISTING.key, retry_skipped=False) == Status.NEEDS_INPUT
    assert ledger.should_skip(LISTING.key, retry_skipped=True) is None
    assert ledger.get(LISTING.key).questions == ["Notice period?"]


def test_errors_and_dry_runs_are_retried(tmp_path: Path):
    ledger = Ledger(tmp_path / "l.sqlite")
    for status in (Status.ERROR, Status.DRY_RUN):
        ledger.record(LISTING, status)
        assert ledger.should_skip(LISTING.key, retry_skipped=False) is None


def test_a_later_record_keeps_what_an_earlier_one_paid_for(tmp_path: Path):
    ledger = Ledger(tmp_path / "l.sqlite")
    report = {"verdict": "strong", "score": 88}
    ledger.record(LISTING, Status.SUBMITTING, report=report, letter="Dear team")
    ledger.record(LISTING, Status.ERROR, reason="form broke")

    entry = ledger.get(LISTING.key)
    assert entry.status == Status.ERROR
    assert entry.report == report
    assert (entry.verdict, entry.score) == ("strong", 88)
    assert ledger.cached_letter(LISTING.key) == "Dear team"


def test_applied_at_is_set_once(tmp_path: Path):
    ledger = Ledger(tmp_path / "l.sqlite")
    ledger.record(LISTING, Status.APPLIED)
    first = ledger.get(LISTING.key).applied_at
    assert first
    assert ledger.counts() == {"applied": 1}
