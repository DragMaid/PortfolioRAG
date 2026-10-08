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


def test_an_application_made_by_hand_can_be_taken_back(tmp_path: Path):
    ledger = Ledger(tmp_path / "l.sqlite")
    ledger.record(LISTING, Status.UNFIT, report={"verdict": "weak", "score": 30})
    ledger.settle(LISTING.key, Status.APPLIED, reason="you applied to it yourself")
    ledger.note_by_hand(LISTING.key, Status.UNFIT)
    assert ledger.get(LISTING.key).by_hand

    assert ledger.take_back(LISTING.key) is Status.UNFIT
    entry = ledger.get(LISTING.key)
    assert entry.status is Status.UNFIT and entry.applied_at is None and not entry.by_hand
    assert entry.score == 30, "the assessment is kept"


def test_one_the_applier_sent_cannot_be_taken_back(tmp_path: Path):
    import pytest

    ledger = Ledger(tmp_path / "l.sqlite")
    ledger.record(LISTING, Status.APPLIED)
    assert not ledger.get(LISTING.key).by_hand
    with pytest.raises(ValueError):
        ledger.take_back(LISTING.key)


def test_a_posting_not_on_record_before_is_forgotten_when_taken_back(tmp_path: Path):
    ledger = Ledger(tmp_path / "l.sqlite")
    ledger.record(LISTING, Status.APPLIED)
    ledger.note_by_hand(LISTING.key, None)

    assert ledger.take_back(LISTING.key) is None
    assert ledger.get(LISTING.key) is None


def test_i_sent_it_from_before_the_column_counts_as_by_hand(tmp_path: Path):
    import sqlite3

    path = tmp_path / "l.sqlite"
    db = sqlite3.connect(path)
    db.executescript(
        "CREATE TABLE postings (key TEXT PRIMARY KEY, board TEXT NOT NULL, job_id TEXT NOT NULL,"
        " url TEXT NOT NULL, apply_url TEXT, title TEXT NOT NULL, company TEXT,"
        " status TEXT NOT NULL, reason TEXT, verdict TEXT, score INTEGER, report TEXT,"
        " letter TEXT, answers TEXT, questions TEXT, artifacts TEXT, first_seen TEXT NOT NULL,"
        " updated_at TEXT NOT NULL, applied_at TEXT);"
        "INSERT INTO postings VALUES ('a','b','1','u',NULL,'t',NULL,'applied',"
        "'you submitted it',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'x','x','x');"
        "INSERT INTO postings VALUES ('b','b','2','u',NULL,'t',NULL,'applied',"
        "'submitted',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'x','x','x');"
    )
    db.commit()
    db.close()

    ledger = Ledger(path)
    assert ledger.get("a").by_hand and ledger.get("a").by_hand_from == "manual"
    assert not ledger.get("b").by_hand
