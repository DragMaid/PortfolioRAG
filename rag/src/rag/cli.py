"""The three entry points, as console scripts.

``rag-worker``  drain the queue — what the container runs
``rag-index``   rebuild one author's index, without going through the queue
``rag-eval``    run the eval suite
``rag-migrate`` resize the embedding column to the configured model's width

The middle two exist so that indexing and evaluation can be exercised from a terminal against
a real database without a running API, which is what makes the pipeline developable.
"""

from __future__ import annotations

import argparse
import logging
import sys

from .db import close_pool, get_pool
from .embeddings import get_embedder
from .indexing import ensure
from .logging_setup import configure_logging
from .settings import get_settings
from .utils import embedding_dimensions, resize_embedding_column
from .worker import Worker

logger = logging.getLogger("rag.cli")


def worker(argv: list[str] | None = None) -> int:
    """Runs the queue worker until it is signalled."""
    parser = argparse.ArgumentParser(prog="rag-worker", description="Drain the RAG job queue.")
    parser.add_argument("--once", action="store_true", help="Run whatever is queued, then exit.")
    args = parser.parse_args(argv)

    settings = get_settings()
    configure_logging(settings.log_level, settings.log_json)

    instance = Worker(settings)

    if args.once:
        instance.prepare()
        instance.drain()
        close_pool()
        return 0

    instance.run()
    return 0


def index(argv: list[str] | None = None) -> int:
    """Rebuilds one author's index in the foreground."""
    parser = argparse.ArgumentParser(prog="rag-index", description="Rebuild a portfolio index.")
    parser.add_argument("author_id", type=int)
    parser.add_argument(
        "--force",
        action="store_true",
        help="Ignore the corpus hash. Still skips passages whose text has not changed.",
    )
    args = parser.parse_args(argv)

    settings = get_settings()
    configure_logging(settings.log_level, settings.log_json)

    embedder = get_embedder(
        settings.embedding_model,
        settings.embedding_dimensions,
        settings.embedding_batch_size,
    )

    try:
        with get_pool(settings).connection() as conn:
            result = ensure(conn, settings, embedder, args.author_id, force=args.force)
    finally:
        close_pool()

    print(
        f"{result.document_count} passages "
        f"({result.embedded} embedded, {result.unchanged} unchanged, {result.deleted} removed) "
        f"in {result.duration_ms}ms"
    )

    return 0


def migrate(argv: list[str] | None = None) -> int:
    """Resizes the embedding column to the configured model's width."""
    parser = argparse.ArgumentParser(
        prog="rag-migrate",
        description=(
            "Resize RagDocuments.Embedding to RAG_EMBEDDING_DIMENSIONS. Clears stored vectors "
            "when the width changes; each author is re-embedded on their next index run."
        ),
    )
    parser.add_argument(
        "--dimensions",
        type=int,
        help="Override RAG_EMBEDDING_DIMENSIONS for this run.",
    )
    args = parser.parse_args(argv)

    settings = get_settings()
    configure_logging(settings.log_level, settings.log_json)

    dimensions = args.dimensions or settings.embedding_dimensions

    try:
        with get_pool(settings).connection() as conn:
            before = embedding_dimensions(conn)
            changed = resize_embedding_column(conn, dimensions)
    finally:
        close_pool()

    if changed:
        print(f"Embedding column resized from vector({before}) to vector({dimensions}).")
    else:
        print(f"Embedding column is already vector({dimensions}); nothing to do.")

    return 0


def evaluate(argv: list[str] | None = None) -> int:
    """Runs the eval suite. Imported lazily — the harness is not needed to serve traffic."""
    from eval.run import main as run_eval

    return run_eval(argv)


if __name__ == "__main__":
    sys.exit(worker())
