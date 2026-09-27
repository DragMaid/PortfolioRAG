from __future__ import annotations

import logging
from collections.abc import Callable
from contextlib import asynccontextmanager
from typing import Annotated, Any

from fastapi import Body, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from rag.settings import Settings
from rag.webchat import Browser

from .runs import Busy, Runs

logger = logging.getLogger(__name__)

# Mirrors the API's own floor. A posting shorter than this has no requirements to read.
MINIMUM_CHARS = 120
MAXIMUM_CHARS = 20000


class RunRequest(BaseModel):
    kind: str = Field(default="job-fit", pattern="^(job-fit|cover-letter)$")
    job_description: str = Field(alias="jobDescription")
    notes: str | None = None

    model_config = {"populate_by_name": True}


def create_app(
    *,
    settings: Settings,
    api_base: str | Callable[[], str],
    site: str,
    browser: Browser,
    headless: bool,
    token: str | Callable[[], str] | None = None,
    runs: Runs | None = None,
) -> FastAPI:
    """The local pipeline as an API. No page: whatever is serving one supplies it.

    ``api_base`` may be a callable, for the same reason ``token`` may: a host whose page can
    point retrieval somewhere else without being restarted.

    ``token`` is for a host that already holds one, so the page it serves need not send a
    credential with every request. It may be a callable, for a host whose token can change
    while it is running — the applier's can, because its page can be given one at any point.
    Without it, every request brings its own.

    ``runs`` is for a host that already owns a browser thread and a provider. Two of either
    cannot coexist: a chat site's profile holds a lock, so a second one would simply fail to
    open. Passing the one already running is what lets the applier serve this beside its own.
    """
    runs = runs or Runs(settings, site=site, browser=browser, headless=headless)

    def _base() -> str:
        """Where retrieval asks. A callable for a host whose page can move it mid-session."""
        return api_base() if callable(api_base) else api_base

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield
        # The browser outlives individual runs, so it is this that closes it.
        runs.close()

    app = FastAPI(title="Portfolio RAG, locally", lifespan=lifespan, docs_url=None, redoc_url=None)

    @app.get("/api/config")
    def config() -> dict[str, Any]:
        """What this service was started with, so the page can state it rather than ask."""
        return {
            "api": _base(),
            "site": site,
            "browser": browser,
            "headless": headless,
            "busy": runs.is_busy,
            "minimumChars": MINIMUM_CHARS,
            "maximumChars": MAXIMUM_CHARS,
        }

    @app.post("/api/runs", status_code=202)
    def start(
        request: Annotated[RunRequest, Body()],
        authorization: Annotated[str | None, Header()] = None,
    ) -> dict[str, Any]:
        api_token = _token(authorization, token() if callable(token) else token)
        posting = request.job_description.strip()

        if len(posting) < MINIMUM_CHARS:
            raise HTTPException(
                400,
                f"Paste a bit more of the posting — at least {MINIMUM_CHARS} characters.",
            )

        if len(posting) > MAXIMUM_CHARS:
            raise HTTPException(
                413,
                f"That posting is {len(posting):,} characters, over the {MAXIMUM_CHARS:,} limit.",
            )

        try:
            run = runs.start(
                kind=request.kind,  # type: ignore[arg-type]
                token=api_token,
                api_base=_base(),
                job_description=posting,
                notes=(request.notes or "").strip() or None,
            )
        except Busy as busy:
            raise HTTPException(409, str(busy)) from busy

        return run.as_dict()

    @app.get("/api/runs/{run_id}")
    def read(run_id: str) -> dict[str, Any]:
        run = runs.get(run_id)

        if run is None:
            raise HTTPException(404, "No such run. This service forgets old ones.")

        return run.as_dict()

    @app.get("/api/runs")
    def recent() -> dict[str, Any]:
        return {"runs": [run.as_dict() for run in runs.recent()]}

    return app


def _token(authorization: str | None, fallback: str | None = None) -> str:
    """The API token off the request, or the one this was started with. Checked for shape.

    Whether it is a *good* token is the portfolio API's business and it will say so; all
    this can usefully catch is a studio access token pasted into the wrong box, which the
    retrieval endpoint would refuse with a message about scopes that explains nothing.
    """
    value = (authorization or "").removeprefix("Bearer ").strip() or (fallback or "").strip()

    if not value:
        raise HTTPException(401, "Paste an API token first — the pfl_ kind, from the studio.")

    if not value.startswith("pfl_"):
        raise HTTPException(
            401,
            "That does not look like an API token. They begin with pfl_ and are issued in "
            "the studio's access tab; a studio session token will not do.",
        )

    return value
