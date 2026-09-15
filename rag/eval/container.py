"""A throwaway Postgres for the eval, migrated the way production is and sized for the model."""

from __future__ import annotations

import os
import shutil
import subprocess
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path

import psycopg

from rag.schema import resize_embedding_column

# The image compose and backend.Tests/PostgresFixture.cs run, so all three agree on pgvector.
IMAGE = "pgvector/pgvector:pg16"

_USER = "portfolio"
_PASSWORD = "portfolio"
_DATABASE = "portfolio"

_REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
_BACKEND_PROJECT = _REPOSITORY_ROOT / "backend" / "backend.csproj"


@contextmanager
def migrated_database(dimensions: int) -> Generator[str]:
    """Starts a pgvector container, migrates it, and yields its connection URL.

    The container and everything in it are gone when the block exits, however it exits.
    """
    # NOTE: imported here so the dev-only dependency is only needed by runs that ask for it
    from testcontainers.community.postgres import PostgresContainer

    _require_toolchain()

    container = PostgresContainer(
        IMAGE,
        username=_USER,
        password=_PASSWORD,
        dbname=_DATABASE,
        driver=None,
    ).with_tmpfs_mount("/var/lib/postgresql/data")

    with container:
        host = container.get_container_host_ip()
        port = container.get_exposed_port(5432)

        _apply_migrations(host, port)

        url = container.get_connection_url()

        with psycopg.connect(url) as conn:
            resize_embedding_column(conn, dimensions)

        yield url


def _require_toolchain() -> None:
    if not _BACKEND_PROJECT.is_file():
        raise RuntimeError(
            f"--container needs the API's migrations and could not find {_BACKEND_PROJECT}. "
            "Run it from a checkout of the repository, not an installed package."
        )

    if shutil.which("dotnet") is None:
        raise RuntimeError("--container applies the API's migrations and needs `dotnet` on PATH.")


def _apply_migrations(host: str, port: int | str) -> None:
    connection_string = (
        f"Host={host};Port={port};Database={_DATABASE};Username={_USER};Password={_PASSWORD}"
    )

    for command in (
        ["dotnet", "tool", "restore"],
        ["dotnet", "ef", "database", "update", "--project", str(_BACKEND_PROJECT)],
    ):
        completed = subprocess.run(
            command,
            cwd=_REPOSITORY_ROOT,
            env={**os.environ, "ConnectionStrings__Postgres": connection_string},
            capture_output=True,
            text=True,
            check=False,
        )

        if completed.returncode != 0:
            output = (completed.stdout + completed.stderr).strip()
            raise RuntimeError(f"`{' '.join(command)}` failed:\n{output[-4000:]}")
