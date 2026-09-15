"""The queue, against a real database.

Marked ``integration`` and skipped by default: it needs the API's schema, which means a
migrated Postgres. Run with ``uv run pytest -m integration`` once ``docker compose up -d db``
and ``dotnet ef database update`` have been done.

What is being tested is the part that cannot be tested any other way — that two workers
racing for the same row get one job each, that a claim is a lease rather than a hand-off,
and that the integers this module hard-codes really are the integers Entity Framework
stores. That last one is the quiet risk in sharing a schema across two runtimes: nothing
would fail loudly if the enums drifted, jobs would simply stop being found.
"""

from __future__ import annotations

import json
import uuid
from collections.abc import Generator
from datetime import UTC, datetime

import pytest
from psycopg.rows import DictRow

from rag import queue
from rag.db import close_pool, execute, fetch_one, get_pool
from rag.settings import Settings

pytestmark = pytest.mark.integration


@pytest.fixture
def settings() -> Settings:
    return Settings(worker_id="test-worker", lease_seconds=600)


@pytest.fixture
def conn(settings: Settings):
    pool = get_pool(settings)
    with pool.connection() as connection:
        yield connection
    close_pool()


@pytest.fixture
def author(conn) -> Generator[int]:
    """A throwaway account. Cascades take everything hung off it on the way out."""
    suffix = uuid.uuid4().hex[:8]

    row = fetch_one(
        conn,
        """
        INSERT INTO "Authors" ("Name", "Email", "Handle", "CreatedAt")
        VALUES ('Queue Test', %s, %s, now())
        RETURNING "Id"
        """,
        (f"queue-{suffix}@localhost.invalid", f"queue-{suffix}"),
    )

    assert row is not None
    yield row["Id"]

    execute(conn, 'DELETE FROM "Authors" WHERE "Id" = %s', (row["Id"],))


def enqueue(
    conn, author_id: int, kind: queue.JobKind = queue.JobKind.INDEX, **columns
) -> uuid.UUID:
    job_id = uuid.uuid4()

    execute(
        conn,
        """
        INSERT INTO "RagJobs"
            ("Id", "AuthorId", "Kind", "Status", "PayloadJson", "Attempts", "MaxAttempts",
             "AvailableAt", "CreatedAt", "InputTokens", "OutputTokens", "CostUsd")
        VALUES (%s, %s, %s, %s, %s::jsonb, 0, %s, now(), now(), 0, 0, 0)
        """,
        (
            job_id,
            author_id,
            kind,
            columns.get("status", queue.Status.QUEUED),
            json.dumps(columns.get("payload", {"force": True})),
            columns.get("max_attempts", 3),
        ),
    )

    return job_id


def status_of(conn, job_id: uuid.UUID) -> DictRow | None:
    return fetch_one(conn, 'SELECT * FROM "RagJobs" WHERE "Id" = %s', (job_id,))


def test_claiming_marks_the_row_running_and_counts_the_attempt(conn, settings, author):
    """Attempts are counted at claim time, not at failure time.

    A job that kills its worker never reaches a failure handler, so counting there would
    retry a poison job forever.
    """
    job_id = enqueue(conn, author)

    job = queue.claim(conn, settings)

    assert job is not None
    assert job.id == job_id
    assert job.attempts == 1

    row = status_of(conn, job_id)
    assert row is not None
    assert row["Status"] == queue.Status.RUNNING.value
    assert row["LockedBy"] == "test-worker"
    assert row["StartedAt"] is not None


def test_a_running_job_is_not_claimed_again_while_its_lease_holds(conn, settings, author):
    enqueue(conn, author)

    assert queue.claim(conn, settings) is not None
    assert queue.claim(conn, settings) is None


def test_a_lapsed_lease_is_reclaimed(conn, settings, author):
    """A worker that dies mid-job must not leave the work stranded."""
    job_id = enqueue(conn, author)
    queue.claim(conn, settings)

    execute(
        conn,
        'UPDATE "RagJobs" SET "LockedAt" = now() - interval \'1 hour\' WHERE "Id" = %s',
        (job_id,),
    )

    reclaimed = queue.claim(conn, settings)

    assert reclaimed is not None
    assert reclaimed.id == job_id
    assert reclaimed.attempts == 2


def test_two_workers_racing_take_one_job_each(conn, settings, author):
    """What SKIP LOCKED buys, and the reason there is no broker.

    Two connections claim concurrently while the first transaction is still open. Without
    SKIP LOCKED the second would block on the first's row lock; with it, it steps over and
    takes the next.
    """
    first_id = enqueue(conn, author)
    second_id = enqueue(conn, author)
    conn.commit()

    pool = get_pool(settings)

    with pool.connection() as one, pool.connection() as two:
        claimed_one = queue.claim(one, settings)
        claimed_two = queue.claim(two, settings)

        assert claimed_one is not None
        assert claimed_two is not None
        assert claimed_one.id != claimed_two.id
        assert {claimed_one.id, claimed_two.id} == {first_id, second_id}


def test_a_job_not_yet_available_is_left_alone(conn, settings, author):
    job_id = enqueue(conn, author)

    execute(
        conn,
        'UPDATE "RagJobs" SET "AvailableAt" = now() + interval \'1 hour\' WHERE "Id" = %s',
        (job_id,),
    )

    assert queue.claim(conn, settings) is None


def test_success_records_the_answer_and_the_spend(conn, settings, author):
    from decimal import Decimal

    enqueue(conn, author)
    job = queue.claim(conn, settings)

    assert job is not None
    queue.succeed(
        conn,
        job,
        {"document_count": 12},
        queue.Usage(input_tokens=1000, output_tokens=200, cost_usd=Decimal("0.01")),
    )

    row = status_of(conn, job.id)
    assert row is not None

    assert row["Status"] == queue.Status.SUCCEEDED
    assert row["ResultJson"] == {"document_count": 12}
    assert row["InputTokens"] == 1000
    assert float(row["CostUsd"]) == pytest.approx(0.01)
    assert row["LockedBy"] is None


def test_failure_schedules_a_retry_until_the_attempts_run_out(conn, settings, author):
    job_id = enqueue(conn, author, max_attempts=2)

    first = queue.claim(conn, settings)
    assert first is not None
    queue.fail(conn, first, "provider timed out")

    row = status_of(conn, job_id)
    assert row is not None
    assert row["Status"] == queue.Status.QUEUED
    assert row["AvailableAt"] > datetime.now(UTC)
    assert row["CompletedAt"] is None

    execute(conn, 'UPDATE "RagJobs" SET "AvailableAt" = now() WHERE "Id" = %s', (job_id,))

    second = queue.claim(conn, settings)
    assert second is not None
    assert second.is_final_attempt

    queue.fail(conn, second, "provider timed out again")

    row = status_of(conn, job_id)
    assert row is not None
    assert row["Status"] == queue.Status.FAILED
    assert row["CompletedAt"] is not None


def test_a_failure_still_records_what_was_spent(conn, settings, author):
    """The budget counts tokens burned on answers that were thrown away."""
    from decimal import Decimal

    job_id = enqueue(conn, author, max_attempts=1)
    job = queue.claim(conn, settings)
    assert job is not None

    queue.fail(conn, job, "the assess step failed", queue.Usage(5000, 900, Decimal("0.05")))

    row = status_of(conn, job_id)
    assert row is not None

    assert row["Status"] == queue.Status.FAILED
    assert row["InputTokens"] == 5000
    assert float(row["CostUsd"]) == pytest.approx(0.05)


def test_a_long_error_is_truncated_rather_than_losing_the_failure(conn, settings, author):
    """The column is 2000 characters; a provider's error body can be far longer."""
    job_id = enqueue(conn, author, max_attempts=1)
    job = queue.claim(conn, settings)

    assert job is not None

    queue.fail(conn, job, "x" * 9000)

    status = status_of(conn, job_id)
    assert status is not None
    error = status["Error"]
    assert len(error) == 2000


def test_the_enum_integers_match_what_the_api_stores(conn, settings, author):
    """The quiet risk in two runtimes sharing one schema.

    These constants are copied from the API's enums. If either side renumbers, jobs stop
    being found rather than anything failing loudly — so the agreement is asserted here.
    """
    fit_id = enqueue(conn, author, kind=queue.JobKind.JOB_FIT)

    row = status_of(conn, fit_id)
    assert row is not None

    assert row["Kind"] == queue.JobKind.JOB_FIT == 1
    assert row["Status"] == queue.Status.QUEUED == 0

    job = queue.claim(conn, settings)
    assert job is not None
    status = status_of(conn, job.id)
    assert status is not None
    assert status["Status"] == queue.Status.RUNNING == 1

    queue.succeed(conn, job, {}, queue.Usage())
    status = status_of(conn, job.id)
    assert status is not None
    assert status["Status"] == queue.Status.SUCCEEDED == 2


@pytest.mark.usefixtures("author")
def test_notify_wakes_a_listener(conn, settings):
    """The optimisation over polling. A lost notification costs latency, not a job."""
    import psycopg

    listener = psycopg.connect(settings.database_url, autocommit=True)

    try:
        listener.execute(f"LISTEN {queue.CHANNEL}")

        conn.execute(f"NOTIFY {queue.CHANNEL}")
        conn.commit()

        assert queue.wait_for_work(listener, timeout=5.0) is True
    finally:
        listener.close()


@pytest.mark.usefixtures("conn", "author")
def test_waiting_times_out_when_nothing_arrives(settings):
    import psycopg

    listener = psycopg.connect(settings.database_url, autocommit=True)

    try:
        assert queue.wait_for_work(listener, timeout=0.3) is False
    finally:
        listener.close()
