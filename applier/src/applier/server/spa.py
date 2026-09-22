"""Serving the built page.

The page is a Vite build committed under ``applier/web/dist`` and force-included in the
wheel, so running the tool needs no Node. Development is the other way round: ``npm run dev``
serves it with hot reload and proxies ``/api`` back here, and this never sees a request.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

_BUILD_HINT = (
    "The page has not been built. Build it once with:\n"
    "    cd applier/web && npm ci && npm run build\n"
    "or run it with hot reload: npm run dev (it proxies /api back to this server)."
)


def build_dir() -> Path | None:
    """Where the built page is, installed or in the repository. None if it was never built."""
    here = Path(__file__).resolve()
    for candidate in (here.parents[1] / "web", here.parents[3] / "web" / "dist"):
        if (candidate / "index.html").is_file():
            return candidate
    return None


def mount(app: FastAPI) -> Path | None:
    """Puts the page under ``/``, or an explanation there if it was never built."""
    directory = build_dir()

    if directory is None:
        @app.get("/{_path:path}", include_in_schema=False)
        def missing(_path: str = "") -> FileResponse:
            raise HTTPException(503, _BUILD_HINT)

        return None

    # html=True makes every unknown path fall back to index.html, which is what a page that
    # routes in the browser needs and what a 404 here would break.
    app.mount("/", StaticFiles(directory=directory, html=True), name="page")
    return directory
