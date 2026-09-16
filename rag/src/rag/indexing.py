"""Keeping the index in agreement with the portfolio.

This module hashes the content and compare with db hash to determine if
re-embedding the post is required or not and will be executed per edits.

It also settles ``RagSources``, the per-source rows the studio's index table reads: each
post, job and profile is marked indexed with its passage count, or failed with the reason,
independently of the others — one source that cannot be embedded does not stop the rest.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from enum import IntEnum

from psycopg import Connection

from . import corpus
from .chunking import Chunk, Chunker
from .db import execute, fetch_all, fetch_one
from .embeddings import Embedder
from .settings import Settings

logger = logging.getLogger(__name__)


class SourceStatus(IntEnum):
    """Mirrors ``Backend.Models.Entities.RagSourceStatus``."""

    QUEUED = 0
    INDEXING = 1
    INDEXED = 2
    FAILED = 3


SourceKey = tuple[int, int]


@dataclass(frozen=True, slots=True)
class IndexResult:
    """What one run did. Returned to the queue as the job's result."""

    document_count: int
    embedded: int
    unchanged: int
    deleted: int
    failed: int
    skipped: bool
    corpus_hash: str
    duration_ms: int

    def as_dict(self) -> dict[str, object]:
        return {
            "document_count": self.document_count,
            "embedded": self.embedded,
            "unchanged": self.unchanged,
            "deleted": self.deleted,
            "failed": self.failed,
            "skipped": self.skipped,
            "corpus_hash": self.corpus_hash,
            "duration_ms": self.duration_ms,
        }


def ensure(
    conn: Connection,
    settings: Settings,
    embedder: Embedder,
    author_id: int,
    force: bool = False,
) -> IndexResult:
    """Brings the author's index up to date, doing as little as possible.

    force: skips only the corpus-hash check, it doesn't automatically
    re-embed the whole document.
    """
    started = time.monotonic()

    documents = corpus.load(conn, author_id)
    digest = corpus.corpus_hash(documents)

    state = fetch_one(
        conn,
        'SELECT "CorpusHash", "DocumentCount" FROM "RagIndexStates" WHERE "AuthorId" = %s',
        (author_id,),
    )

    if not force and state is not None and state["CorpusHash"] == digest:
        # Nothing changed since a run in which every source succeeded, so anything the API
        # queued in the meantime (a save with no edits) is already indexed as it stands.
        _settle_unchanged(conn, author_id)

        logger.info(
            "Index is already current.",
            extra={"author_id": author_id, "documents": state["DocumentCount"]},
        )
        return IndexResult(
            document_count=state["DocumentCount"],
            embedded=0,
            unchanged=state["DocumentCount"],
            deleted=0,
            failed=0,
            skipped=True,
            corpus_hash=digest,
            duration_ms=int((time.monotonic() - started) * 1000),
        )

    chunker = Chunker(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        min_chars=settings.min_chunk_chars,
    )

    # NOTE: the dict key is the 3 first attributes while the value is the hash
    existing = {
        (row["SourceType"], row["SourceId"], row["ChunkIndex"]): row["ContentHash"]
        for row in fetch_all(
            conn,
            """
            SELECT "SourceType", "SourceId", "ChunkIndex", "ContentHash"
            FROM "RagDocuments"
            WHERE "AuthorId" = %s
            """,
            (author_id,),
        )
    }

    # NOTE: a chunk whose embedding is missing is treated as changed
    missing_vectors = {
        (row["SourceType"], row["SourceId"], row["ChunkIndex"])
        for row in fetch_all(
            conn,
            """
            SELECT "SourceType", "SourceId", "ChunkIndex"
            FROM "RagDocuments"
            WHERE "AuthorId" = %s AND "Embedding" IS NULL
            """,
            (author_id,),
        )
    }

    kept: list[Chunk] = []
    failures: dict[SourceKey, str] = {}
    passages: dict[SourceKey, int] = {}
    embedded = 0

    # One source at a time, so a failure is pinned to the source that caused it and the
    # others still land. Embedding is batched inside each source.
    for document in documents:
        key = (document.source_type.value, document.source_id)

        try:
            chunks = chunker.split(document)
        except Exception as error:
            logger.exception("Could not split a source.", extra={"author_id": author_id})
            failures[key] = f"Could not be split into passages: {error}"
            continue

        if not chunks:
            failures[key] = (
                "Nothing long enough to index. Add more text to it and it will be picked up "
                "automatically."
            )
            continue

        # A chunk requires re-embed if existing content hash is different
        # from the current chunk content hash or its missing vector embeddings
        stale = [
            chunk
            for chunk in chunks
            if existing.get(chunk.key) != chunk.content_hash or chunk.key in missing_vectors
        ]

        if stale:
            try:
                vectors = embedder.embed_passages([chunk.content for chunk in stale])
                _upsert(conn, author_id, stale, vectors)
            except Exception as error:
                logger.exception("Could not embed a source.", extra={"author_id": author_id})
                failures[key] = f"Embedding failed: {type(error).__name__}: {error}"
                continue

        embedded += len(stale)
        kept.extend(chunks)
        passages[key] = len(chunks)

    # A failed source keeps whatever passages it had, so yesterday's text still answers
    # rather than the source vanishing from retrieval because today's edit would not embed.
    protected = [key for key in existing if (key[0], key[1]) in failures]
    deleted = _delete_departed(conn, author_id, [chunk.key for chunk in kept] + protected)

    labels = {(d.source_type.value, d.source_id): d.label for d in documents}
    _write_sources(conn, author_id, labels, passages, failures)

    # A hash is only a promise that everything is indexed. Leaving it unset after a partial
    # run means the next one retries the failures instead of skipping past them.
    _write_state(conn, author_id, None if failures else digest, len(kept))

    duration_ms = int((time.monotonic() - started) * 1000)

    logger.info(
        "Index rebuilt.",
        extra={
            "author_id": author_id,
            "documents": len(kept),
            "embedded": embedded,
            "deleted": deleted,
            "failed_sources": len(failures),
            "duration_ms": duration_ms,
        },
    )

    return IndexResult(
        document_count=len(kept),
        embedded=embedded,
        unchanged=len(kept) - embedded,
        deleted=deleted,
        failed=len(failures),
        skipped=False,
        corpus_hash=digest,
        duration_ms=duration_ms,
    )


def _upsert(
    conn: Connection,
    author_id: int,
    chunks: list[Chunk],
    vectors: list[list[float]],
) -> None:
    """Writes passages and their vectors, replacing whatever occupied those positions."""
    with conn.cursor() as cursor:
        cursor.executemany(
            """
            INSERT INTO "RagDocuments"
                ("AuthorId", "SourceType", "SourceId", "SourceLabel", "ChunkIndex",
                 "Content", "ContentHash", "MetadataJson", "UpdatedAt", "Embedding")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, now(), %s::vector)
            ON CONFLICT ("AuthorId", "SourceType", "SourceId", "ChunkIndex")
            DO UPDATE SET
                "SourceLabel" = EXCLUDED."SourceLabel",
                "Content"     = EXCLUDED."Content",
                "ContentHash" = EXCLUDED."ContentHash",
                "MetadataJson"= EXCLUDED."MetadataJson",
                "UpdatedAt"   = now(),
                "Embedding"   = EXCLUDED."Embedding"
            """,
            [
                (
                    author_id,
                    chunk.source_type.value,
                    chunk.source_id,
                    chunk.source_label[:300],
                    chunk.chunk_index,
                    chunk.content,
                    chunk.content_hash,
                    json.dumps(chunk.metadata),
                    str(vector),
                )
                for chunk, vector in zip(chunks, vectors, strict=True)
            ],
        )


def _delete_departed(
    conn: Connection,
    author_id: int,
    keys: list[tuple[int, int, int]],
) -> int:
    """Removes rows for passages the corpus no longer contains."""

    # No chunks mean author has nothing left so remove everything
    if not keys:
        return execute(conn, 'DELETE FROM "RagDocuments" WHERE "AuthorId" = %s', (author_id,))

    # NOTE: jsonb_array_elements used here to convert jsonb object
    # into individual elements and extract all 3 of them as text to convert to int
    return execute(
        conn,
        """
        DELETE FROM "RagDocuments"
        WHERE "AuthorId" = %s
          AND ("SourceType", "SourceId", "ChunkIndex") NOT IN (
              SELECT (value->>0)::int,
                     (value->>1)::int,
                     (value->>2)::int
              FROM jsonb_array_elements(%s::jsonb) AS value
          )
        """,
        (author_id, json.dumps([list(key) for key in keys])),
    )


def _write_sources(
    conn: Connection,
    author_id: int,
    labels: dict[SourceKey, str],
    passages: dict[SourceKey, int],
    failures: dict[SourceKey, str],
) -> None:
    """Settles every source this run saw, and drops rows for sources it did not.

    ``now()`` is the start of this transaction, which began before the corpus was read. A
    row the API re-queued after that describes an edit this run never saw, so it is left
    queued for the run that will — both here and in the delete below, which would otherwise
    remove a post published a moment ago.
    """
    rows = [
        (
            author_id,
            key[0],
            key[1],
            labels[key][:300],
            SourceStatus.FAILED if key in failures else SourceStatus.INDEXED,
            failures.get(key, "")[:2000] or None,
            passages.get(key, 0),
        )
        for key in labels
    ]

    with conn.cursor() as cursor:
        cursor.executemany(
            """
            INSERT INTO "RagSources"
                ("AuthorId", "SourceType", "SourceId", "Label", "Status", "Error",
                 "PassageCount", "QueuedAt", "IndexedAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, now(), CASE WHEN %s::text IS NULL THEN now() END)
            ON CONFLICT ("AuthorId", "SourceType", "SourceId") DO UPDATE SET
                "Label"        = EXCLUDED."Label",
                "Status"       = EXCLUDED."Status",
                "Error"        = EXCLUDED."Error",
                "PassageCount" = CASE WHEN EXCLUDED."Error" IS NULL
                                      THEN EXCLUDED."PassageCount"
                                      ELSE "RagSources"."PassageCount" END,
                "IndexedAt"    = COALESCE(EXCLUDED."IndexedAt", "RagSources"."IndexedAt")
            WHERE "RagSources"."QueuedAt" <= now()
            """,
            [(*row, row[5]) for row in rows],
        )

    execute(
        conn,
        """
        DELETE FROM "RagSources"
        WHERE "AuthorId" = %s
          AND "QueuedAt" <= now()
          AND ("SourceType", "SourceId") NOT IN (
              SELECT (value->>0)::int, (value->>1)::int
              FROM jsonb_array_elements(%s::jsonb) AS value
          )
        """,
        (author_id, json.dumps([list(key) for key in labels])),
    )


def _settle_unchanged(conn: Connection, author_id: int) -> None:
    """Marks sources queued before this run indexed, when the corpus has not moved."""
    execute(
        conn,
        """
        UPDATE "RagSources"
        SET "Status" = %s, "Error" = NULL, "IndexedAt" = now()
        WHERE "AuthorId" = %s
          AND "Status" IN (%s, %s)
          AND "QueuedAt" <= now()
        """,
        (SourceStatus.INDEXED, author_id, SourceStatus.QUEUED, SourceStatus.INDEXING),
    )


def mark_indexing(conn: Connection, author_id: int) -> None:
    """Shows queued sources as being worked on. Run on its own connection and committed
    straight away, because the run itself commits only at the end."""
    execute(
        conn,
        'UPDATE "RagSources" SET "Status" = %s WHERE "AuthorId" = %s AND "Status" = %s',
        (SourceStatus.INDEXING, author_id, SourceStatus.QUEUED),
    )


def _write_state(conn: Connection, author_id: int, digest: str | None, count: int) -> None:
    execute(
        conn,
        """
        INSERT INTO "RagIndexStates" ("AuthorId", "BuiltAt", "DocumentCount", "CorpusHash", "Error")
        VALUES (%s, now(), %s, %s, NULL)
        ON CONFLICT ("AuthorId") DO UPDATE SET
            "BuiltAt"       = now(),
            "DocumentCount" = EXCLUDED."DocumentCount",
            "CorpusHash"    = EXCLUDED."CorpusHash",
            "Error"         = NULL
        """,
        (author_id, count, digest),
    )


def record_failure(conn: Connection, author_id: int, error: str, final: bool = True) -> None:
    """Leaves the reason a rebuild failed where the studio can show it.

    Deliberately does not clear ``CorpusHash`` or the document count: yesterday's index is
    still there and still answering, and the studio's job is to say that it is stale, not to
    pretend it is gone.

    The sources the run was working on go back to queued while it has attempts left, and to
    failed with the reason once it has none.
    """
    execute(
        conn,
        """
        INSERT INTO "RagIndexStates" ("AuthorId", "DocumentCount", "Error")
        VALUES (%s, 0, %s)
        ON CONFLICT ("AuthorId") DO UPDATE SET "Error" = EXCLUDED."Error"
        """,
        (author_id, error[:2000]),
    )

    execute(
        conn,
        """
        UPDATE "RagSources"
        SET "Status" = %s, "Error" = %s
        WHERE "AuthorId" = %s AND "Status" IN (%s, %s)
        """,
        (
            SourceStatus.FAILED if final else SourceStatus.QUEUED,
            error[:2000] if final else None,
            author_id,
            SourceStatus.QUEUED,
            SourceStatus.INDEXING,
        ),
    )
