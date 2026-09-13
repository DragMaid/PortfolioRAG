"""The loop.

One job at a time, deliberately. The work is dominated by a single long provider call, so
concurrency inside a process buys little; scaling out means running more replicas, which
``SELECT … FOR UPDATE SKIP LOCKED`` handles without any coordination between them.

Two connections are held. One does the work, inside a transaction per job. The other sits
in autocommit doing nothing but ``LISTEN`` — a listener that shared the working connection
would miss notifications for the whole length of a job, which is exactly when they arrive.
"""

from __future__ import annotations

import logging
import signal
import time
from types import FrameType

import psycopg

from . import credentials, indexing, queue
from .crypto import decode_encryption_key
from .db import assert_embedding_column, close_pool, get_pool
from .embeddings import Embedder, get_embedder
from .pipeline import JobFitPipeline, JobFitRequest, PipelineError
from .providers import get_provider
from .providers.registry import UnknownProviderError
from .queue import Job, Usage
from .settings import Settings

logger = logging.getLogger(__name__)


class Worker:
    """Drains the queue until it is asked to stop."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self._running = True
        self._encryption_key = decode_encryption_key(settings.encryption_key.get_secret_value())
        self._embedder: Embedder | None = None
        self._pipeline: JobFitPipeline | None = None

    def prepare(self) -> None:
        """Everything that must be true before a job is claimed.

        Done up front so a misconfiguration is a worker that refuses to start, rather than
        one that starts, claims a visitor's request, and fails it three times.
        """
        pool = get_pool(self.settings)

        with pool.connection() as conn:
            assert_embedding_column(conn, self.settings.embedding_dimensions)

        self._embedder = get_embedder(
            self.settings.embedding_model,
            self.settings.embedding_dimensions,
            self.settings.embedding_batch_size,
        )

        logger.info(
            "Worker ready.",
            extra={
                "worker_id": self.settings.worker_id,
                "embedding_model": self.settings.embedding_model,
                "dimensions": self._embedder.dimensions,
            },
        )

    def stop(self, *_: object) -> None:
        """Finish the job in hand, then exit. Wired to SIGINT and SIGTERM."""
        if self._running:
            logger.info("Stopping after the current job.")
            self._running = False

    def run(self) -> None:
        self.prepare()

        signal.signal(signal.SIGINT, self._signal)
        signal.signal(signal.SIGTERM, self._signal)

        # Its own connection, outside the pool: it spends its life blocked in LISTEN and
        # would otherwise hold a pooled connection hostage.
        listener = psycopg.connect(self.settings.database_url, autocommit=True)

        try:
            while self._running:
                worked = self.drain()

                if not worked and self._running:
                    queue.wait_for_work(listener, self.settings.poll_interval_seconds)
        finally:
            listener.close()
            close_pool()
            logger.info("Worker stopped.")

    def drain(self) -> bool:
        """Runs every job currently on the queue. Returns whether anything was done.

        Public because it is also the whole of ``rag-worker --once``, which is how the
        queue is exercised from a terminal and from the integration tests.
        """
        did_work = False

        while self._running:
            pool = get_pool(self.settings)

            with pool.connection() as conn:
                job = queue.claim(conn, self.settings)

            if job is None:
                return did_work

            did_work = True
            self._run_job(job)

        return did_work

    def _run_job(self, job: Job) -> None:
        started = time.monotonic()

        logger.info(
            "Claimed a job.",
            extra={
                "job_id": str(job.id),
                "kind": "index" if job.kind == queue.JobKind.KIND_INDEX else "job_fit",
                "author_id": job.author_id,
                "attempt": job.attempts,
            },
        )

        pool = get_pool(self.settings)
        self._pipeline = None

        # NOTE: the work and the row that records it commit together. A job that succeeded
        # and then could not be marked succeeded would be run again, and for an analysis that
        # means a second bill.
        try:
            with pool.connection() as conn:
                if job.kind == queue.JobKind.KIND_INDEX:
                    result, usage = self._run_index(conn, job)

                elif job.kind == queue.JobKind.KIND_JOB_FIT:
                    result, usage = self._run_job_fit(conn, job)

                else:
                    raise PipelineError(f"Unknown job kind {job.kind}.")

                queue.succeed(conn, job, result, usage)

            logger.info(
                "Job finished.",
                extra={
                    "job_id": str(job.id),
                    "duration_ms": int((time.monotonic() - started) * 1000),
                },
            )

        except (credentials.MissingCredentialError, UnknownProviderError) as error:
            # Nothing about these improves on a retry: the credential will not repair itself
            # between attempts, and three tries only delays the message by a few minutes.
            self._fail(job, str(error), Usage(), final=True)

        except PipelineError as error:
            self._fail(job, str(error), self._spent())

        except Exception as error:
            logger.exception("A job raised.", extra={"job_id": str(job.id)})
            self._fail(job, f"{type(error).__name__}: {error}", Usage())

    def _run_index(self, conn, job: Job) -> tuple[dict, Usage]:
        force = bool(job.payload.get("force", False))

        try:
            result = indexing.ensure(
                conn,
                self.settings,
                self._require_embedder(),
                job.author_id,
                force=force,
            )
        except Exception as error:
            indexing.record_failure(conn, job.author_id, str(error))
            raise

        # Indexing costs no provider tokens
        return result.as_dict(), Usage()

    def _run_job_fit(self, conn, job: Job) -> tuple[dict, Usage]:
        credential = credentials.load(conn, job.author_id, self._encryption_key)
        provider = get_provider(credential.provider)

        # Making sure that embeddings are up to date via hash (no force)
        indexing.ensure(conn, self.settings, self._require_embedder(), job.author_id)

        pipeline = JobFitPipeline(
            settings=self.settings,
            provider=provider,
            embedder=self._require_embedder(),
            api_key=credential.api_key,
            model=credential.model,
        )

        # Kept so a failure part-way through can still report its spend. See _spent.
        self._pipeline = pipeline

        outcome = pipeline.run(
            conn,
            job.author_id,
            JobFitRequest(
                job_description=job.payload.get("job_description", ""),
                role_title=job.payload.get("role_title"),
                company=job.payload.get("company"),
            ),
        )

        return outcome.report, outcome.usage

    def _fail(self, job: Job, message: str, usage: Usage, final: bool = False) -> None:
        """Records a failure on a fresh connection, because the job's was rolled back."""
        pool = get_pool(self.settings)

        exhausted = Job(
            id=job.id,
            author_id=job.author_id,
            kind=job.kind,
            payload=job.payload,
            attempts=job.max_attempts if final else job.attempts,
            max_attempts=job.max_attempts,
        )

        with pool.connection() as conn:
            queue.fail(conn, exhausted, message, usage)

    def _spent(self) -> Usage:
        """What a failed pipeline had already spent, if it got far enough to spend anything.

        Tokens burned before a stage raised are on the author's bill whether or not an
        answer came back, so they are recorded against the job and counted by the budget.
        """
        return self._pipeline.usage if self._pipeline is not None else Usage()

    def _require_embedder(self) -> Embedder:
        if self._embedder is None:
            raise RuntimeError("prepare() was not called.")
        return self._embedder

    def _signal(self, signum: int, _frame: FrameType | None) -> None:
        logger.info("Signal received.", extra={"signal": signum})
        self.stop()
