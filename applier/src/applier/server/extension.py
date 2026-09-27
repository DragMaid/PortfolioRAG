"""What the browser extension talks to: ``/api/ext/*``.

The extension fills application forms in the person's own browser — the manual queue's
postings, and any other form they point it at. It reads the fields off the page, sends them
here, and fills in what comes back. Everything that decides is still here: the candidate's
details and the answers they gave before are tried first, then the model, whose answers
must cite a fact exactly as they must on a board's form. What nothing answers comes back as
``unknown`` for the side panel to ask, and what the person types there is remembered.

Every route wants the pairing key in ``X-Applier-Key``, shown on the controller's page. The
server listens on the loopback interface only, but any page open in the same browser can
reach 127.0.0.1, and these routes hand out answers and a resume. There is deliberately no
CORS here: the extension's service worker is exempt from it by its host permission, and no
web page needs to read any of this.
"""

from __future__ import annotations

import hmac
from typing import Annotated, Any

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ..controller import ControllerError, Session

VERSION = 1


class FillRequest(BaseModel):
    url: str = ""
    title: str = ""
    fields: list[dict[str, Any]] = Field(default_factory=list)
    # False answers from the candidate's details and remembered answers only: instant, for a
    # form that grew a step, where the model has already been asked about the rest.
    use_model: bool = Field(default=True, alias="useModel")

    model_config = {"populate_by_name": True}


class RememberRequest(BaseModel):
    field: dict[str, Any]
    answer: str | list[str]


def mount(app: FastAPI, session: Session) -> None:
    # Not called ``key``: the routes below take a posting's key as a path parameter, and
    # FastAPI would read a dependency's parameter of the same name from the path.
    def authorised(
        applier_key: Annotated[str | None, Header(alias="X-Applier-Key")] = None,
    ) -> None:
        expected = session.secrets.extension_key
        given = applier_key or ""
        if not given or not hmac.compare_digest(given.encode(), expected.encode()):
            raise HTTPException(401, "The extension's key does not match. Pair it again.")

    def guarded[T](work) -> T:
        try:
            return work()
        except ControllerError as error:
            raise HTTPException(409, str(error)) from error

    router = APIRouter(prefix="/api/ext", dependencies=[Depends(authorised)])

    @router.get("/status")
    def status() -> dict[str, Any]:
        llm = session.config.llm
        return {
            "ok": True,
            "version": VERSION,
            "model": llm.site if llm.provider == "web" else llm.provider,
            "candidate": session.config.candidate.name,
            "resume": session.packet_resume.upload is not None,
            "remembered": len(session.memory.entries()),
            "manual": session.status()["manual"],
        }

    @router.post("/fill")
    def fill(request: FillRequest) -> dict[str, Any]:
        job = session.manual_for(request.url) if request.url else None
        role = (job or {}).get("title") or request.title
        suggested = guarded(
            lambda: session.suggest_answers(
                request.fields, role=role, use_model=request.use_model
            )
        )
        return suggested | {"job": job}

    @router.post("/remember")
    def remember(request: RememberRequest) -> dict[str, Any]:
        return guarded(lambda: session.remember_answer(request.field, request.answer))

    @router.get("/memory")
    def memory() -> dict[str, Any]:
        return {"answers": session.remembered()}

    @router.delete("/memory")
    def forget(key: Annotated[str, Query()]) -> dict[str, Any]:
        return {"forgotten": session.forget_answer(key)}

    @router.get("/job")
    def job(url: Annotated[str, Query()]) -> dict[str, Any]:
        return {"job": session.manual_for(url)}

    @router.get("/jobs/{key:path}/letter")
    def letter(key: str) -> dict[str, Any]:
        return {"letter": guarded(lambda: session.letter_for(key))}

    @router.post("/jobs/{key:path}/submitted")
    def submitted(key: str) -> dict[str, Any]:
        return guarded(lambda: session.mark_submitted(key))

    @router.get("/resume")
    def resume() -> FileResponse:
        path = guarded(session.resume_file)
        return FileResponse(path, filename=path.name)

    app.include_router(router)

    # For the controller's own page: the key to paste into the extension's options.
    @app.get("/api/extension")
    def pairing() -> dict[str, Any]:
        return {"key": session.secrets.extension_key, "version": VERSION}

    @app.post("/api/extension/key")
    def rotate() -> dict[str, Any]:
        return {"key": session.secrets.rotate_extension_key(), "version": VERSION}

