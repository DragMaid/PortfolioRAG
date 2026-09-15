"""Keeping the index in agreement with the portfolio.

This module hashes the content and compare with db hash to determine if
re-embedding the post is required or not and will be executed per edits.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass

from psycopg import Connection

from . import corpus
from .chunking import Chunk, Chunker
from .db import execute, fetch_all, fetch_one
from .embeddings import Embedder
from .settings import Settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class IndexResult:
    """What one run did. Returned to the queue as the job's result."""

    document_count: int
    embedded: int
    unchanged: int
    deleted: int
    skipped: bool
    corpus_hash: str
    duration_ms: int

    def as_dict(self) -> dict[str, object]:
        return {
            "document_count": self.document_count,
            "embedded": self.embedded,
            "unchanged": self.unchanged,
            "deleted": self.deleted,
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
        logger.info(
            "Index is already current.",
            extra={"author_id": author_id, "documents": state["DocumentCount"]},
        )
        return IndexResult(
            document_count=state["DocumentCount"],
            embedded=0,
            unchanged=state["DocumentCount"],
            deleted=0,
            skipped=True,
            corpus_hash=digest,
            duration_ms=int((time.monotonic() - started) * 1000),
        )

    chunker = Chunker(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        min_chars=settings.min_chunk_chars,
    )

    chunks = chunker.split_all(documents)

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

    # A chunk requires re-embed if existing content hash is different
    # from the current chunk content hash or its missing vector embeddings
    stale = [
        chunk
        for chunk in chunks
        if existing.get(chunk.key) != chunk.content_hash or chunk.key in missing_vectors
    ]

    unchanged = len(chunks) - len(stale)

    # NOTE: since within a vector db, order doesn't matter so doing in this
    # greatly increase the processing speed based on chunk instead of whole document
    if stale:
        logger.info(
            "Embedding changed passages.",
            extra={"author_id": author_id, "stale": len(stale), "unchanged": unchanged},
        )
        vectors = embedder.embed_passages([chunk.content for chunk in stale])
        _upsert(conn, author_id, stale, vectors)

    # Delete all chunks indexes that no longer belongs
    deleted = _delete_departed(conn, author_id, chunks)

    # Update new index state in db
    _write_state(conn, author_id, digest, len(chunks))

    duration_ms = int((time.monotonic() - started) * 1000)

    logger.info(
        "Index rebuilt.",
        extra={
            "author_id": author_id,
            "documents": len(chunks),
            "embedded": len(stale),
            "deleted": deleted,
            "duration_ms": duration_ms,
        },
    )

    return IndexResult(
        document_count=len(chunks),
        embedded=len(stale),
        unchanged=unchanged,
        deleted=deleted,
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


def _delete_departed(conn: Connection, author_id: int, chunks: list[Chunk]) -> int:
    """Removes rows for passages the corpus no longer contains."""

    # No chunks mean author has nothing left so remove everything
    if not chunks:
        return execute(conn, 'DELETE FROM "RagDocuments" WHERE "AuthorId" = %s', (author_id,))

    keys = [list(chunk.key) for chunk in chunks]

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
        (author_id, json.dumps(keys)),
    )


def _write_state(conn: Connection, author_id: int, digest: str, count: int) -> None:
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


def record_failure(conn: Connection, author_id: int, error: str) -> None:
    """Leaves the reason a rebuild failed where the studio can show it.

    Deliberately does not clear ``CorpusHash`` or the document count: yesterday's index is
    still there and still answering, and the studio's job is to say that it is stale, not to
    pretend it is gone.
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
