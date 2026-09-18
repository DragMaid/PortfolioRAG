"""Per-source index statuses, against the fixture portfolio in a live database.

What the studio's index table shows is written here, so the cases that matter are the ones
a user would see go wrong: a source that cannot be embedded must fail on its own with a
reason, keep the passages it already had, and leave everything else indexed.
"""

from __future__ import annotations

import pytest
from eval import fixture

from rag import indexing
from rag.db import close_pool, fetch_all, get_pool
from rag.embeddings import get_embedder
from rag.indexing import SourceStatus
from rag.settings import Settings

pytestmark = pytest.mark.integration


@pytest.fixture
def portfolio():
    settings = Settings()
    embedder = get_embedder(
        settings.embedding_model, settings.embedding_dimensions, settings.embedding_batch_size
    )

    with get_pool(settings).connection() as conn:
        author_id = fixture.seed(conn)
        yield conn, settings, embedder, author_id
        fixture.purge(conn)

    close_pool()


class FailingEmbedder:
    """Embeds normally, except for any batch containing ``poison``."""

    def __init__(self, inner, poison: str):
        self.inner = inner
        self.poison = poison

    def embed_passages(self, texts: list[str]) -> list[list[float]]:
        if any(self.poison in text for text in texts):
            raise RuntimeError("the model choked")
        return self.inner.embed_passages(texts)


def sources(conn, author_id: int) -> dict[tuple[int, int], dict]:
    rows = fetch_all(
        conn,
        'SELECT * FROM "RagSources" WHERE "AuthorId" = %s',
        (author_id,),
    )
    return {(row["SourceType"], row["SourceId"]): row for row in rows}


def post_ids(conn, author_id: int) -> list[int]:
    rows = fetch_all(
        conn,
        'SELECT "Id" FROM "Posts" WHERE "AuthorId" = %s ORDER BY "Id"',
        (author_id,),
    )
    return [row["Id"] for row in rows]


def post_passages(conn, author_id: int, post_id: int) -> set[int]:
    rows = fetch_all(
        conn,
        """
        SELECT "Id" FROM "RagDocuments"
        WHERE "AuthorId" = %s AND "SourceType" = 2 AND "SourceId" = %s
        """,
        (author_id, post_id),
    )
    return {row["Id"] for row in rows}


def test_every_source_is_listed_indexed_with_its_passage_count(portfolio):
    conn, settings, embedder, author_id = portfolio

    result = indexing.ensure(conn, settings, embedder, author_id, force=True)
    rows = sources(conn, author_id)

    assert result.failed == 0
    assert rows, "the run wrote no source rows"
    assert all(row["Status"] == SourceStatus.INDEXED for row in rows.values())
    assert sum(row["PassageCount"] for row in rows.values()) == result.document_count
    assert all(row["IndexedAt"] is not None for row in rows.values())


def test_a_source_that_will_not_embed_fails_alone_and_keeps_its_old_passages(portfolio):
    conn, settings, embedder, author_id = portfolio
    indexing.ensure(conn, settings, embedder, author_id, force=True)

    target = post_ids(conn, author_id)[0]
    before = post_passages(conn, author_id, target)

    conn.execute(
        'UPDATE "Posts" SET "Body" = "Body" || %s WHERE "Id" = %s',
        ("\n\nPOISON-MARKER appended paragraph.", target),
    )

    result = indexing.ensure(
        conn, settings, FailingEmbedder(embedder, "POISON-MARKER"), author_id, force=True  # type: ignore[arg-type]
    )
    rows = sources(conn, author_id)
    failed = rows[(2, target)]

    assert result.failed == 1
    assert failed["Status"] == SourceStatus.FAILED
    assert "the model choked" in failed["Error"]
    assert all(
        row["Status"] == SourceStatus.INDEXED for key, row in rows.items() if key != (2, target)
    )

    assert before <= post_passages(conn, author_id, target)

    # A partial run must not record the corpus as done, or the next run would skip the retry.
    state = fetch_all(
        conn, 'SELECT "CorpusHash" FROM "RagIndexStates" WHERE "AuthorId" = %s', (author_id,)
    )
    assert state[0]["CorpusHash"] is None

    retry = indexing.ensure(conn, settings, embedder, author_id)
    assert retry.failed == 0
    assert sources(conn, author_id)[(2, target)]["Status"] == SourceStatus.INDEXED


def test_an_unpublished_post_leaves_the_table(portfolio):
    conn, settings, embedder, author_id = portfolio
    indexing.ensure(conn, settings, embedder, author_id, force=True)

    target = post_ids(conn, author_id)[0]
    conn.execute('UPDATE "Posts" SET "IsDraft" = true WHERE "Id" = %s', (target,))

    indexing.ensure(conn, settings, embedder, author_id)

    assert (2, target) not in sources(conn, author_id)


def test_an_unchanged_corpus_still_settles_what_the_api_queued(portfolio):
    conn, settings, embedder, author_id = portfolio
    indexing.ensure(conn, settings, embedder, author_id, force=True)
    conn.commit()

    # A save with no edits: the API re-queues the row, but nothing about the text moved.
    conn.execute(
        'UPDATE "RagSources" SET "Status" = %s WHERE "AuthorId" = %s',
        (SourceStatus.QUEUED, author_id),
    )
    conn.commit()

    result = indexing.ensure(conn, settings, embedder, author_id)

    assert result.skipped
    assert all(row["Status"] == SourceStatus.INDEXED for row in sources(conn, author_id).values())


def test_a_final_failure_marks_the_waiting_sources_failed(portfolio):
    conn, settings, embedder, author_id = portfolio
    indexing.ensure(conn, settings, embedder, author_id, force=True)
    conn.execute(
        'UPDATE "RagSources" SET "Status" = %s WHERE "AuthorId" = %s',
        (SourceStatus.INDEXING, author_id),
    )

    indexing.record_failure(conn, author_id, "database went away", final=False)
    assert all(row["Status"] == SourceStatus.QUEUED for row in sources(conn, author_id).values())

    indexing.record_failure(conn, author_id, "database went away", final=True)
    rows = sources(conn, author_id).values()
    assert all(row["Status"] == SourceStatus.FAILED for row in rows)
    assert all(row["Error"] == "database went away" for row in rows)
