"""The entry points, as console scripts.

``rag-worker``  drain the queue — what the container runs
``rag-index``   rebuild one author's index, without going through the queue
``rag-eval``    run the eval suite
``rag-migrate`` resize the embedding column to the configured model's width
``rag-local``   serve the pipeline locally, through a signed-in chat site in a browser

The middle two exist so that indexing and evaluation can be exercised from a terminal against
a real database without a running API, which is what makes the pipeline developable. The last
needs neither a database nor a key: it reaches a running API for passages and a browser for
everything else — see :mod:`rag.local.service`.
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


def local(argv: list[str] | None = None) -> int:
    """Serves the local pipeline on 127.0.0.1. See rag.local.service."""
    import uvicorn

    from .local.service import create_app
    from .webchat import BROWSERS, SITES

    parser = argparse.ArgumentParser(
        prog="rag-local",
        description=(
            "Run the job-fit and cover-letter pipelines on this machine: passages come from "
            "the portfolio API with your API token, and every model call happens in a chat "
            "site you are already signed in to. Nothing is billed."
        ),
    )
    parser.add_argument(
        "--site",
        choices=sorted(SITES),
        default="gemini",
        help="Which signed-in chat site answers. Sign in once with `python -m rag.webchat login`.",
    )
    parser.add_argument(
        "--api",
        default="http://localhost:5009",
        help="The portfolio API this asks for passages (default %(default)s).",
    )
    parser.add_argument(
        "--browser",
        choices=BROWSERS,
        default="camoufox",
        help="Browser to drive (default %(default)s, the one that works headless).",
    )
    parser.add_argument(
        "--headed",
        action="store_true",
        help="Show the browser window, and wait longer for a sign-in if one is needed.",
    )
    parser.add_argument("--port", type=int, default=5173)
    args = parser.parse_args(argv)

    settings = get_settings()
    configure_logging(settings.log_level, settings.log_json)

    app = create_app(
        settings=settings,
        api_base=args.api,
        site=args.site,
        browser=args.browser,
        headless=not args.headed,
    )

    logger.info("Serving the local pipeline on http://127.0.0.1:%s", args.port)

    uvicorn.run(app, host="127.0.0.1", port=args.port, log_config=None)

    return 0
