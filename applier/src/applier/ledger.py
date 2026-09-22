"""Every posting this has looked at, and what became of it. One SQLite file.

The ledger is what makes a run safe to repeat. A posting with a terminal status is never
opened again — above all ``applied``, because applying twice to the same employer is the one
mistake here that cannot be taken back. ``needs_input`` and ``error`` are retried: the first
when ``--retry-skipped`` says a fact has been added, the second on every run.

Two statuses exist for the controller, where a person is watching and deciding: ``pending``
is a posting that cleared the policy and is waiting to be picked, and ``awaiting_human`` is
one whose form is filled and sitting at its review page in a tab, waiting to be submitted by
hand. Both outlive the process that wrote them, so closing the controller and opening it
again finds the same shortlist and the same hand-offs.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import closing
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path
from typing import Any

from .models import Listing


class Status(StrEnum):
    APPLIED = "applied"
    # Assessed, a fit, and waiting for a person to pick it. Only the controller writes this.
    PENDING = "pending"
    # Filled up to the review page and handed over in a tab. Whether it was sent is the
    # person's to say, so nothing automatic ever touches it again.
    AWAITING_HUMAN = "awaiting_human"
    # A person said no: to a pending row, or to one they were handed and chose not to send.
    SKIPPED = "skipped"
    # Everything filled and captured at the review step, but nothing sent.
    DRY_RUN = "dry_run"
    UNFIT = "unfit"
    EXCLUDED = "excluded"
    EXTERNAL = "external"
    UNAVAILABLE = "unavailable"
    NEEDS_INPUT = "needs_input"
    ERROR = "error"
    # Submitted, but the board never confirmed it. A human has to look.
    UNCONFIRMED = "unconfirmed"
    # Written just before a real submission and replaced by what happened. Still here means
    # the process died mid-flight, and whether it went is unknown — so it is never retried.
    SUBMITTING = "submitting"


# Never opened again. DRY_RUN is not here: a real run should go on to apply, and neither is
# PENDING: a shortlist that was never picked from is worth offering again.
TERMINAL = {
    Status.APPLIED,
    Status.AWAITING_HUMAN,
    Status.SKIPPED,
    Status.UNFIT,
    Status.EXCLUDED,
    Status.EXTERNAL,
    Status.UNAVAILABLE,
    Status.UNCONFIRMED,
    Status.SUBMITTING,
}

_SCHEMA = """
CREATE TABLE IF NOT EXISTS postings (
    key          TEXT PRIMARY KEY,
    board        TEXT NOT NULL,
    job_id       TEXT NOT NULL,
    url          TEXT NOT NULL,
    title        TEXT NOT NULL,
    company      TEXT,
    status       TEXT NOT NULL,
    reason       TEXT,
    verdict      TEXT,
    score        INTEGER,
    report       TEXT,
    letter       TEXT,
    answers      TEXT,
    questions    TEXT,
    artifacts    TEXT,
    first_seen   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    applied_at   TEXT
);
CREATE INDEX IF NOT EXISTS postings_status ON postings (status);
"""


@dataclass(slots=True)
class Entry:
    key: str
    status: Status
    title: str
    company: str | None
    url: str
    reason: str | None
    verdict: str | None
    score: int | None
    questions: list[str]
    report: dict[str, Any] | None
    letter: str | None
    answers: dict[str, Any]
    artifacts: str | None
    board: str
    updated_at: str
    applied_at: str | None


class Ledger:
    """One SQLite file, and one lock in front of it.

    The CLI's run is a single thread and needed neither. The controller is a thread per board
    plus the server's own, all writing the same postings, so the connection is opened for any
    thread to use and every statement goes through the lock. Writes to one SQLite file
    serialise regardless; this only makes that explicit, and keeps a read from landing
    between the two halves of a write.
    """

    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self._lock = threading.RLock()
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._db.executescript(_SCHEMA)

    def close(self) -> None:
        with self._lock:
            self._db.close()

    def get(self, key: str) -> Entry | None:
        with self._lock:
            row = self._db.execute("SELECT * FROM postings WHERE key = ?", (key,)).fetchone()
        return _entry(row) if row else None

    def should_skip(self, key: str, *, retry_skipped: bool) -> Status | None:
        """The status that rules a posting out of this run, or None to go ahead."""
        entry = self.get(key)
        if entry is None:
            return None
        if entry.status in TERMINAL:
            return entry.status
        if entry.status == Status.NEEDS_INPUT and not retry_skipped:
            return entry.status
        return None

    def record(
        self,
        listing: Listing,
        status: Status,
        *,
        title: str | None = None,
        company: str | None = None,
        reason: str | None = None,
        report: dict[str, Any] | None = None,
        letter: str | None = None,
        answers: dict[str, Any] | None = None,
        questions: list[str] | None = None,
        artifacts: Path | None = None,
    ) -> None:
        now = datetime.now(UTC).isoformat(timespec="seconds")
        values = {
            "key": listing.key,
            "board": listing.board,
            "job_id": listing.job_id,
            "url": listing.url,
            "title": title or listing.title,
            "company": company or listing.company,
            "status": status.value,
            "reason": reason,
            "verdict": report.get("verdict") if report else None,
            "score": report.get("score") if report else None,
            "report": json.dumps(report) if report else None,
            "letter": letter,
            "answers": json.dumps(answers) if answers else None,
            "questions": json.dumps(questions) if questions else None,
            "artifacts": str(artifacts) if artifacts else None,
            "now": now,
            "applied_at": now if status == Status.APPLIED else None,
        }

        # A later, thinner record (an error, say) must not wipe the report an earlier one
        # paid for, so every optional column keeps its old value when the new one is null.
        with self._lock, self._db:
            self._db.execute(
                """
                INSERT INTO postings (key, board, job_id, url, title, company, status, reason,
                    verdict, score, report, letter, answers, questions, artifacts,
                    first_seen, updated_at, applied_at)
                VALUES (:key, :board, :job_id, :url, :title, :company, :status, :reason,
                    :verdict, :score, :report, :letter, :answers, :questions, :artifacts,
                    :now, :now, :applied_at)
                ON CONFLICT (key) DO UPDATE SET
                    title = excluded.title,
                    company = COALESCE(excluded.company, company),
                    status = excluded.status,
                    reason = excluded.reason,
                    verdict = COALESCE(excluded.verdict, verdict),
                    score = COALESCE(excluded.score, score),
                    report = COALESCE(excluded.report, report),
                    letter = COALESCE(excluded.letter, letter),
                    answers = COALESCE(excluded.answers, answers),
                    questions = excluded.questions,
                    artifacts = COALESCE(excluded.artifacts, artifacts),
                    updated_at = excluded.updated_at,
                    applied_at = COALESCE(excluded.applied_at, applied_at)
                """,
                values,
            )

    def settle(self, key: str, status: Status, *, reason: str | None = None) -> None:
        """Moves a posting already on record to another status, keeping everything else.

        What the controller's *I submitted it* and *Discard* buttons do. The reassessment,
        the letter and the answers a run paid for all stay, so a settled row still opens in
        the drawer with everything it was decided on.
        """
        now = datetime.now(UTC).isoformat(timespec="seconds")
        with self._lock, self._db:
            self._db.execute(
                """
                UPDATE postings
                   SET status = :status,
                       reason = :reason,
                       updated_at = :now,
                       applied_at = CASE WHEN :applied THEN :now ELSE applied_at END
                 WHERE key = :key
                """,
                {
                    "key": key,
                    "status": status.value,
                    "reason": reason,
                    "now": now,
                    "applied": status == Status.APPLIED,
                },
            )

    def cached_report(self, key: str) -> dict[str, Any] | None:
        """An assessment already paid for. Reused when a posting comes back for a retry."""
        entry = self.get(key)
        return entry.report if entry else None

    def cached_letter(self, key: str) -> str | None:
        with self._lock:
            row = self._db.execute(
                "SELECT letter FROM postings WHERE key = ?", (key,)
            ).fetchone()
        return row["letter"] if row else None

    def entries(self, status: Status | None = None, limit: int = 50) -> list[Entry]:
        query = "SELECT * FROM postings"
        args: tuple = ()
        if status is not None:
            query += " WHERE status = ?"
            args = (status.value,)
        query += " ORDER BY updated_at DESC LIMIT ?"
        with self._lock, closing(self._db.execute(query, (*args, limit))) as cursor:
            return [_entry(row) for row in cursor.fetchall()]

    def counts(self) -> dict[str, int]:
        with self._lock:
            rows = self._db.execute(
                "SELECT status, COUNT(*) AS n FROM postings GROUP BY status"
            ).fetchall()
        return {row["status"]: row["n"] for row in rows}


def _entry(row: sqlite3.Row) -> Entry:
    return Entry(
        key=row["key"],
        status=Status(row["status"]),
        title=row["title"],
        company=row["company"],
        url=row["url"],
        reason=row["reason"],
        verdict=row["verdict"],
        score=row["score"],
        questions=json.loads(row["questions"]) if row["questions"] else [],
        report=json.loads(row["report"]) if row["report"] else None,
        letter=row["letter"],
        answers=json.loads(row["answers"]) if row["answers"] else {},
        artifacts=row["artifacts"],
        board=row["board"],
        updated_at=row["updated_at"],
        applied_at=row["applied_at"],
    )
