"""The job queue: one table, claimed with SKIP LOCKED and woken with LISTEN/NOTIFY."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from enum import IntEnum
from typing import Any
from uuid import UUID

from psycopg import Connection

from .db import execute, fetch_one
from .settings import Settings

logger = logging.getLogger(__name__)

# Shared with Backend.Repositories.RagRepository.QueueChannel.
CHANNEL = "rag_jobs"


class Status(IntEnum):
    QUEUED = 0
    RUNNING = 1
    SUCCEEDED = 2
    FAILED = 3
    CANCELLED = 4


class JobKind(IntEnum):
    INDEX = 0
    JOB_FIT = 1
    COVER_LETTER = 2
    RETRIEVAL = 3


@dataclass(frozen=True, slots=True)
class Job:
    """A claimed row. Held for the length of its lease."""

    id: UUID
    author_id: int
    kind: JobKind
    payload: dict[str, Any]
    attempts: int
    max_attempts: int

    @property
    def is_final_attempt(self) -> bool:
        return self.attempts >= self.max_attempts


@dataclass(frozen=True, slots=True)
class Usage:
    """What a job spent, recorded whether or not it produced an answer."""

    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: Decimal = Decimal("0")

    def __add__(self, other: Usage) -> Usage:
        return Usage(
            input_tokens=self.input_tokens + other.input_tokens,
            output_tokens=self.output_tokens + other.output_tokens,
            cost_usd=self.cost_usd + other.cost_usd,
        )


def claim(conn: Connection, settings: Settings) -> Job | None:
    """Takes the oldest available job, or returns None when there is nothing to do."""

    # NOTE: get jobs that are not locked and update status accordingly
    CLAIM_SQL = """
    WITH claimed AS (
        SELECT "Id"
        FROM "RagJobs"
        WHERE ("Status" = %(queued)s AND "AvailableAt" <= now())
           OR ("Status" = %(running)s AND "LockedAt" < now() - make_interval(secs => %(lease)s))
        ORDER BY "AvailableAt", "CreatedAt"
        FOR UPDATE SKIP LOCKED
        LIMIT 1
    )
    UPDATE "RagJobs" AS j
    SET "Status"    = %(running)s,
        "LockedBy"  = %(worker)s,
        "LockedAt"  = now(),
        "StartedAt" = COALESCE(j."StartedAt", now()),
        "Attempts"  = j."Attempts" + 1
    FROM claimed
    WHERE j."Id" = claimed."Id"
    RETURNING j."Id", j."AuthorId", j."Kind", j."PayloadJson", j."Attempts", j."MaxAttempts";
    """

    row = fetch_one(
        conn,
        CLAIM_SQL,
        {
            "queued": Status.QUEUED,
            "running": Status.RUNNING,
            "lease": settings.lease_seconds,
            "worker": settings.worker_id,
        },
    )

    if row is None:
        return None

    payload = row["PayloadJson"]

    # NOTE: handle both if object decoded or still raw as string
    return Job(
        id=row["Id"],
        author_id=row["AuthorId"],
        kind=JobKind(row["Kind"]),
        payload=payload if isinstance(payload, dict) else json.loads(payload or "{}"),
        attempts=row["Attempts"],
        max_attempts=row["MaxAttempts"],
    )


def succeed(
    conn: Connection,
    job: Job,
    result: dict[str, Any] | None,
    usage: Usage,
) -> None:
    """Records the answer and what it cost."""
    execute(
        conn,
        """
        UPDATE "RagJobs"
        SET "Status"       = %(status)s,
            "ResultJson"   = %(result)s,
            "CompletedAt"  = now(),
            "LockedBy"     = NULL,
            "LockedAt"     = NULL,
            "Error"        = NULL,
            "InputTokens"  = %(input_tokens)s,
            "OutputTokens" = %(output_tokens)s,
            "CostUsd"      = %(cost)s
        WHERE "Id" = %(id)s
        """,
        {
            "status": Status.SUCCEEDED,
            "result": json.dumps(result) if result is not None else None,
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "cost": usage.cost_usd,
            "id": job.id,
        },
    )


def fail(conn: Connection, job: Job, error: str, usage: Usage | None = None) -> None:
    """Fails a job, scheduling a retry unless this was the last attempt.

    The spend is written either way. Tokens burned on an answer that was discarded are
    still on somebody's bill, and a budget that only counted successes would be a budget
    that a persistently failing job could walk straight past.
    """
    usage = usage or Usage()
    retry = not job.is_final_attempt

    # Exponential, from the attempt already counted at claim time: 2s, 4s, 8s … capped.
    # Not jittered, because at most a handful of jobs are ever in flight and the thundering
    # herd jitter defends against needs a crowd.
    backoff = min(2**job.attempts, 300)

    execute(
        conn,
        """
        UPDATE "RagJobs"
        SET "Status"       = %(status)s,
            "Error"        = %(error)s,
            "LockedBy"     = NULL,
            "LockedAt"     = NULL,
            "AvailableAt"  = CASE WHEN %(retry)s
                                  THEN now() + make_interval(secs => %(backoff)s)
                                  ELSE "AvailableAt" END,
            "CompletedAt"  = CASE WHEN %(retry)s THEN NULL ELSE now() END,
            "InputTokens"  = "InputTokens"  + %(input_tokens)s,
            "OutputTokens" = "OutputTokens" + %(output_tokens)s,
            "CostUsd"      = "CostUsd"      + %(cost)s
        WHERE "Id" = %(id)s
        """,
        {
            "status": Status.QUEUED if retry else Status.FAILED,
            "error": error[:2000],  # Truncated so it fits
            "retry": retry,
            "backoff": backoff,
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "cost": usage.cost_usd,
            "id": job.id,
        },
    )

    logger.warning(
        "Job failed.",
        extra={
            "job_id": str(job.id),
            "attempt": job.attempts,
            "max_attempts": job.max_attempts,
            "retry_in_seconds": backoff if retry else None,
            "error": error[:300],
        },
    )


def wait_for_work(conn: Connection, timeout: float) -> bool:
    """Blocks until a NOTIFY arrives on the queue channel or the timeout elapses.

    Returns whether it was woken. The caller looks for work either way — see the module
    docstring: the notification saves latency, it does not carry the job.
    """
    # NOTE: this connection is the worker's listener and is used for nothing else. LISTEN
    # only takes effect on commit, which is why the caller puts it in autocommit; a LISTEN
    # inside an open transaction would sit there registering nothing.
    conn.execute(f"LISTEN {CHANNEL}")

    # Several notifications mean what one means — "there is work" — so the first ends the
    # wait and the rest are left in the buffer for the next pass to collapse.
    for _ in conn.notifies(timeout=timeout, stop_after=1):
        return True

    return False


def utcnow() -> datetime:
    return datetime.now(UTC)
