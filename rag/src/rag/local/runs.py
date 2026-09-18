from __future__ import annotations

import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Literal

from rag.cover_letter import CoverLetterPipeline, CoverLetterRequest
from rag.pipeline import JobFitPipeline, JobFitRequest, PipelineError
from rag.providers.web import WebProvider
from rag.settings import Settings
from rag.webchat import Browser

from .api import ApiError, ApiRetriever, PortfolioApi

logger = logging.getLogger(__name__)

Kind = Literal["job-fit", "cover-letter"]
_STARTING = "starting"
_DONE = "done"
_MAX_SCROLL_SIZE = 10


@dataclass
class Run:
    """What the page is shown about a run in flight, and about a finished one."""

    id: str
    kind: Kind
    status: Literal["running", "succeeded", "failed"] = "running"
    stage: str = _STARTING
    stages: list[str] = field(default_factory=list)
    started_at: float = field(default_factory=time.monotonic)
    finished_at: float | None = None
    report: dict[str, Any] | None = None
    error: str | None = None

    @property
    def elapsed(self) -> int:
        return int((self.finished_at or time.monotonic()) - self.started_at)

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "kind": self.kind,
            "status": self.status,
            "stage": self.stage,
            "stages": self.stages,
            "elapsed": self.elapsed,
            "report": self.report,
            "error": self.error,
        }


class Busy(RuntimeError):
    """A run is already in flight. One browser profile, one run."""


class Runs:
    """The service's state: a browser, whatever is running, and the last few results."""

    def __init__(self, settings: Settings, *, site: str, browser: Browser, headless: bool):
        self.settings = settings
        self.site = site
        self.browser = browser
        self.headless = headless

        self._lock = threading.Lock()
        self._runs: dict[str, Run] = {}
        self._order: list[str] = []
        self._current: str | None = None
        self._web: WebProvider | None = None

    def close(self) -> None:
        if self._web is not None:
            self._web.close()
            self._web = None

    def _provider(self) -> WebProvider:
        """The browser, opened on first use and kept for the life of the service.

        Kept rather than reopened per run: opening a profile and restoring a signed-in
        session is the slowest thing here by a wide margin, and the pipeline makes three
        calls per run that would each pay for it.
        """
        if self._web is None:
            self._web = WebProvider(
                browser=self.browser,
                headless=self.headless,
                login_timeout=600 if not self.headless else 90,
                log=lambda message: logger.info("%s", message),
            )

        return self._web

    def get(self, run_id: str) -> Run | None:
        with self._lock:
            return self._runs.get(run_id)

    def recent(self, limit: int = 5) -> list[Run]:
        with self._lock:
            return [self._runs[key] for key in reversed(self._order[-limit:])]

    @property
    def is_busy(self) -> bool:
        with self._lock:
            return self._current is not None

    def start(
        self,
        *,
        kind: Kind,
        token: str,
        api_base: str,
        job_description: str,
        notes: str | None = None,
    ) -> Run:
        run = Run(id=uuid.uuid4().hex, kind=kind)

        with self._lock:
            if self._current is not None:
                raise Busy(
                    "A run is already going. One browser profile serves one conversation at "
                    "a time, so this one has to wait for it."
                )

            self._current = run.id
            self._runs[run.id] = run
            self._order.append(run.id)

            # Implement lazy loading
            while len(self._order) > _MAX_SCROLL_SIZE:
                self._runs.pop(self._order.pop(0), None)

        thread = threading.Thread(
            target=self._run,
            args=(run, kind, token, api_base, job_description, notes),
            name=f"run-{run.id[:8]}",
            daemon=True,
        )
        thread.start()

        return run

    def _run(
        self,
        run: Run,
        kind: Kind,
        token: str,
        api_base: str,
        job_description: str,
        notes: str | None,
    ) -> None:
        def stage(name: str) -> None:
            with self._lock:
                run.stage = name
                run.stages.append(name)

        try:
            retriever = ApiRetriever(PortfolioApi(api_base, token))
            provider = self._provider()

            # The site is the model, as far as WebProvider is concerned — each call opens a
            # fresh conversation there. No key, and nothing billed.
            pipeline_type = JobFitPipeline if kind == "job-fit" else CoverLetterPipeline
            pipeline = pipeline_type(
                settings=self.settings,
                provider=provider,
                api_key="",
                model=self.site,
            )

            if isinstance(pipeline, CoverLetterPipeline):
                # It has no stage callback of its own; these are the three it runs.
                stage("extract")
                outcome = pipeline.write(
                    retriever,
                    CoverLetterRequest(job_description=job_description, notes=notes),
                )
            else:
                outcome = pipeline.run(
                    retriever,
                    JobFitRequest(job_description=job_description),
                    on_stage=stage,
                )

            with self._lock:
                run.report = outcome.report
                run.status = "succeeded"
                run.stage = _DONE
                run.finished_at = time.monotonic()

            logger.info("Run finished in %ss.", run.elapsed, extra={"run_id": run.id})

        except (ApiError, PipelineError) as error:
            self._fail(run, str(error))
        except Exception as error:
            logger.exception("A local run raised.", extra={"run_id": run.id})
            self._fail(run, f"{type(error).__name__}: {error}")
        finally:
            with self._lock:
                self._current = None

    def _fail(self, run: Run, message: str) -> None:
        with self._lock:
            run.status = "failed"
            run.error = message
            run.finished_at = time.monotonic()
