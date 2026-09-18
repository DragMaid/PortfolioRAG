from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Any

from fastapi import Body, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from rag.settings import Settings
from rag.webchat import Browser

from .runs import Busy, Runs

logger = logging.getLogger(__name__)

STATIC = Path(__file__).parent / "static"

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
    api_base: str,
    site: str,
    browser: Browser,
    headless: bool,
) -> FastAPI:
    runs = Runs(settings, site=site, browser=browser, headless=headless)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield
        # The browser outlives individual runs, so it is this that closes it.
        runs.close()

    app = FastAPI(title="Portfolio RAG, locally", lifespan=lifespan, docs_url=None, redoc_url=None)

    @app.get("/")
    def page() -> FileResponse:
        return FileResponse(STATIC / "index.html")

    @app.get("/api/config")
    def config() -> dict[str, Any]:
        """What this service was started with, so the page can state it rather than ask."""
        return {
            "api": api_base,
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
        token = _token(authorization)
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
                token=token,
                api_base=api_base,
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


def _token(authorization: str | None) -> str:
    """The API token off the page's request, checked only for shape.

    Whether it is a *good* token is the portfolio API's business and it will say so; all
    this can usefully catch is a studio access token pasted into the wrong box, which the
    retrieval endpoint would refuse with a message about scopes that explains nothing.
    """
    value = (authorization or "").removeprefix("Bearer ").strip()

    if not value:
        raise HTTPException(401, "Paste an API token first — the pfl_ kind, from the studio.")

    if not value.startswith("pfl_"):
        raise HTTPException(
            401,
            "That does not look like an API token. They begin with pfl_ and are issued in "
            "the studio's access tab; a studio session token will not do.",
        )

    return value
