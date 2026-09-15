from __future__ import annotations

import logging

from psycopg import Connection, sql

from .db import execute, fetch_one

logger = logging.getLogger(__name__)

# pgvector's HNSW index refuses a ``vector`` column wider than this. A wider model would need
# halfvec or a different index, which is a design change rather than a resize.
MAX_INDEXED_DIMENSIONS = 2000


def embedding_dimensions(conn: Connection) -> int | None:
    """The column's current width, or None if the migrations have not created it yet."""
    row = fetch_one(
        conn,
        """
        SELECT a.atttypmod AS dimensions
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        WHERE c.relname = 'RagDocuments' AND a.attname = 'Embedding' AND NOT a.attisdropped
        """,
    )

    return None if row is None else row["dimensions"]


def resize_embedding_column(conn: Connection, dimensions: int) -> bool:
    """Makes ``"RagDocuments"."Embedding"`` exactly ``dimensions`` wide.

    Returns whether anything changed. Idempotent: a column already at that width is left
    alone, vectors included. Runs in the caller's transaction, so a failure part-way leaves
    the old column and its index exactly as they were.
    """
    if not 1 <= dimensions <= MAX_INDEXED_DIMENSIONS:
        raise ValueError(
            f"Cannot index {dimensions}-dimensional vectors: pgvector's HNSW index takes 1 to "
            f"{MAX_INDEXED_DIMENSIONS}."
        )

    current = embedding_dimensions(conn)

    if current is None:
        raise RuntimeError(
            'The "RagDocuments"."Embedding" column does not exist. Run the API migrations '
            "first: dotnet ef database update --project backend/backend.csproj"
        )

    if current == dimensions:
        return False

    logger.warning(
        "Resizing the embedding column; every stored vector is cleared.",
        extra={"from": current, "to": dimensions},
    )

    # NOTE: the index is dropped first because it is built for the old width, and recreated
    # after with the same definition RagPipeline.cs gives it
    execute(conn, 'DROP INDEX IF EXISTS "IX_RagDocuments_Embedding"')

    # NOTE: a type modifier cannot be a bound parameter, so the width is composed in as a
    # literal — it has been range-checked as an int above
    with conn.cursor() as cursor:
        cursor.execute(
            sql.SQL(
                'ALTER TABLE "RagDocuments" '
                'ALTER COLUMN "Embedding" TYPE vector({width}) USING NULL'
            ).format(width=sql.Literal(dimensions))
        )

    execute(
        conn,
        """
        CREATE INDEX "IX_RagDocuments_Embedding"
        ON "RagDocuments"
        USING hnsw ("Embedding" vector_cosine_ops)
        """,
    )

    # NOTE: without this an unchanged portfolio would match its corpus hash and skip the
    # rebuild, leaving every author with passages and no vectors
    execute(conn, 'UPDATE "RagIndexStates" SET "CorpusHash" = NULL')

    return True
