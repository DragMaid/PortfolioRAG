"""The connection pool, and the handful of conventions every query here follows.

Identifiers are quoted and PascalCase throughout, because the schema is Entity Framework's
and Postgres folds unquoted names to lower case. That is ugly and it is not negotiable: the
API owns the schema, and a worker that renamed things for its own comfort would be a second
opinion about what the tables are called.
"""

from __future__ import annotations

import logging
from collections.abc import Generator
from contextlib import contextmanager
from typing import LiteralString

from psycopg import Connection
from psycopg.abc import Params
from psycopg.rows import DictRow, dict_row
from psycopg_pool import ConnectionPool

from .settings import Settings

logger = logging.getLogger(__name__)

_pool: ConnectionPool | None = None


def get_pool(settings: Settings) -> ConnectionPool:
    """The process's pool, opened on first use."""
    global _pool

    if _pool is None:
        _pool = ConnectionPool(
            conninfo=settings.database_url,
            min_size=settings.pool_min_size,
            max_size=settings.pool_max_size,
            kwargs={"row_factory": dict_row},
            open=True,
        )
        logger.info("Opened the database pool.", extra={"max_size": settings.pool_max_size})

    return _pool


def close_pool() -> None:
    """Shuts the pool down. Called on the way out so a stopped worker frees its connections."""
    global _pool

    if _pool is not None:
        _pool.close()
        _pool = None


@contextmanager
def connection(settings: Settings) -> Generator[Connection]:
    """A pooled connection inside a transaction that commits on success and rolls back on error."""
    pool = get_pool(settings)

    with pool.connection() as conn:
        yield conn


def fetch_all(conn: Connection, sql: LiteralString, params: Params | None = None) -> list[DictRow]:
    with conn.cursor(row_factory=dict_row) as cursor:
        cursor.execute(sql, params)
        return cursor.fetchall()


def fetch_one(conn: Connection, sql: LiteralString, params: Params | None= None) -> DictRow | None:
    with conn.cursor(row_factory=dict_row) as cursor:
        cursor.execute(sql, params)
        return cursor.fetchone()


def execute(conn: Connection, sql: LiteralString, params: Params | None = None) -> int:
    with conn.cursor() as cursor:
        cursor.execute(sql, params)
        return cursor.rowcount


def assert_embedding_column(conn: Connection, expected_dimensions: int) -> None:
    """Refuses to run when the configured embedding model does not fit the column.

    Worth a query at startup because the alternative failure is much worse and much later:
    every insert rejected at the end of an index run that has already paid to embed the
    whole corpus, or — if the widths happen to collide — a silently meaningless index.
    """
    row = fetch_one(
        conn,
        """
        SELECT a.atttypmod AS dimensions
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        WHERE c.relname = 'RagDocuments' AND a.attname = 'Embedding'
        """,
    )

    if row is None:
        raise RuntimeError(
            'The "RagDocuments"."Embedding" column does not exist. Run the API migrations '
            "first: dotnet ef database update --project backend/backend.csproj"
        )

    actual = row["dimensions"]

    if actual != expected_dimensions:
        raise RuntimeError(
            f'"RagDocuments"."Embedding" is vector({actual}) but RAG_EMBEDDING_DIMENSIONS is '
            f"{expected_dimensions}. Either configure the model whose width the column was "
            "built for, or run `rag-migrate` to resize the column (it clears the stored "
            "vectors; each author is re-embedded on their next index run)."
        )
