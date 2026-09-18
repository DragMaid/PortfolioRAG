"""The retrieval-only job, through the worker, against a real database.

This is the join the local pipeline stands on: a ``Retrieval`` row goes on the queue, the
worker answers it without ever loading a credential, and what lands in ``ResultJson`` is the
shape ``RetrievalResultDto`` reads and ``rag.local.api`` turns back into passages.

Marked ``integration``: it needs the API's schema and the embedding model. Run it with
``uv run pytest -m integration`` once ``docker compose up -d db`` and
``dotnet ef database update`` have been done.
"""

from __future__ import annotations

import json
import uuid
from typing import Any

import pytest
from eval import fixture

from rag import indexing, queue
from rag.db import close_pool, execute, fetch_one, get_pool
from rag.embeddings import get_embedder
from rag.settings import Settings
from rag.worker import Worker

pytestmark = pytest.mark.integration


@pytest.fixture
def settings() -> Settings:
    return Settings(worker_id="retrieval-test")


@pytest.fixture
def indexed(settings: Settings):
    """The fixture portfolio, indexed, with no provider key anywhere near it."""
    embedder = get_embedder(
        settings.embedding_model, settings.embedding_dimensions, settings.embedding_batch_size
    )

    with get_pool(settings).connection() as conn:
        author_id = fixture.seed(conn)
        indexing.ensure(conn, settings, embedder, author_id, force=True)

        # The account this runs against has no credential: the fixture seeds one only when
        # the eval is given a key, and nothing here asks for one. That is the property under
        # test as much as the result shape is.
        execute(conn, 'DELETE FROM "LlmCredentials" WHERE "AuthorId" = %s', (author_id,))
        conn.commit()

        yield conn, author_id

        fixture.purge(conn)

    close_pool()


def enqueue(conn, author_id: int, queries: list[str]) -> uuid.UUID:
    job_id = uuid.uuid4()

    execute(
        conn,
        """
        INSERT INTO "RagJobs"
            ("Id", "AuthorId", "Kind", "Status", "PayloadJson", "Attempts", "MaxAttempts",
             "AvailableAt", "CreatedAt", "InputTokens", "OutputTokens", "CostUsd")
        VALUES (%s, %s, %s, %s, %s::jsonb, 0, 3, now(), now(), 0, 0, 0)
        """,
        (
            job_id,
            author_id,
            queue.JobKind.RETRIEVAL,
            queue.Status.QUEUED,
            json.dumps({"queries": queries}),
        ),
    )

    # Committed here rather than at the end of the fixture's block: the worker claims on its
    # own connection and cannot see a row this one is still holding open.
    conn.commit()

    return job_id


def result_of(conn, job_id: uuid.UUID) -> dict[str, Any]:
    conn.commit()
    row = fetch_one(conn, 'SELECT * FROM "RagJobs" WHERE "Id" = %s', (job_id,))
    assert row is not None
    assert row["Status"] == queue.Status.SUCCEEDED.value, row["Error"]

    # Nothing was spent, because nothing was called.
    assert row["InputTokens"] == 0
    assert row["OutputTokens"] == 0
    assert row["CostUsd"] == 0

    return row["ResultJson"]


def test_a_search_is_answered_without_a_provider_key(indexed, settings):
    conn, author_id = indexed
    job_id = enqueue(conn, author_id, ["built a replication layer in production"])

    worker = Worker(settings)
    worker.prepare()
    worker.drain()

    result = result_of(conn, job_id)

    assert result["author_name"]
    assert result["queries"] == ["built a replication layer in production"]
    assert result["passages"], "the fixture portfolio should answer this search"

    passage = result["passages"][0]

    # snake_case and a named source type: what the .NET side deserialises, and what
    # rag.local.api reads back.
    assert passage["source_type"] in {"profile", "experience", "post"}
    assert passage["content"]
    assert isinstance(passage["document_id"], int)
    assert passage["matched_queries"]


def test_several_searches_are_fused_into_one_shortlist(indexed, settings):
    """One request, one fused list — the thing a caller cannot reproduce by asking twice."""
    conn, author_id = indexed
    queries = [
        "built a replication layer in production",
        "swift ios app store release",
        "published write-up about the design",
    ]
    job_id = enqueue(conn, author_id, queries)

    worker = Worker(settings)
    worker.prepare()
    worker.drain()

    result = result_of(conn, job_id)
    documents = [passage["document_id"] for passage in result["passages"]]

    assert result["queries"] == queries
    assert len(documents) == len(set(documents)), "a fused list must not repeat a passage"
    assert len(result["passages"]) <= settings.context_passages
