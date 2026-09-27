"""The server: the controller's API, rag's local API, and the page.

Every endpoint here is thin. The controller decides nothing in this module — it queues work
onto a board's thread and answers with the row as it stands, and what actually happened
arrives at the page over ``/api/events`` when it happens. That is why buttons answer at once
even while a board is halfway through a form.

It listens on the loopback interface only, and holds the portfolio token the run was started
with so that the page never has to.
"""

from __future__ import annotations

import json
import logging
import queue
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated, Any

import anyio.to_thread
from fastapi import Body, FastAPI, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import ValidationError
from rag.local.runs import Runs
from rag.local.service import create_app as create_rag_app
from rag.settings import get_settings

from ..config import Config
from ..controller import ControllerError, Session, settings_of
from ..errors import ConfigError
from ..ledger import Status
from . import extension, spa

logger = logging.getLogger(__name__)

# Long enough that a quiet run does not churn, short enough to keep a proxy from deciding
# the stream is dead.
_KEEPALIVE = 15.0
# How often the stream comes up for air to notice the page has gone.
_BREATH = 1.0


def create_app(config: Config, *, headless: bool = False) -> FastAPI:
    session = Session(config, headless=headless)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield
        session.close()

    app = FastAPI(
        title="applier",
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )

    # The one session this server is. Reachable for tests, and for anything that needs to
    # look at the run from outside a request.
    app.state.session = session

    _controller_routes(app, session)
    _setup_routes(app, session)
    _config_routes(app, session)
    _ledger_routes(app, session)
    extension.mount(app, session)
    app.mount("/api/rag", _rag_app(session), name="rag")
    spa.mount(app)

    return app


def _rag_app(session: Session) -> FastAPI:
    """``rag.local``'s own API, on this session's model thread.

    The applier is already driving the chat site — its assessments and cover letters go
    through the same signed-in session — and a chat site's profile can only be open once. So
    the provider and the thread are lent rather than opened again, and the portfolio API and
    its token are read from this session rather than sent with every request.
    """
    config = session.config
    runs = Runs(
        get_settings(),
        site=session.llm.model_name,
        browser=config.llm.browser,
        headless=config.llm.headless,
        provider=lambda: session.llm.provider,
        submit=lambda work, *args: session.llm.call(work, *args),
    )
    return create_rag_app(
        settings=get_settings(),
        # Callables, not values: the page can move the portfolio API or paste a token at any
        # point, including after this app was mounted, and a run afterwards picks both up.
        api_base=lambda: session.config.portfolio.api,
        site=session.llm.model_name,
        browser=config.llm.browser,
        headless=config.llm.headless,
        token=lambda: session.secrets.portfolio_token,
        runs=runs,
    )


def _controller_routes(app: FastAPI, session: Session) -> None:
    def guarded[T](work) -> T:
        try:
            return work()
        except ControllerError as error:
            raise HTTPException(409, str(error)) from error

    @app.get("/api/config")
    def read_config() -> dict[str, Any]:
        return session.describe()

    @app.get("/api/status")
    def status() -> dict[str, Any]:
        return session.status()

    @app.patch("/api/settings")
    def settings(patch: Annotated[dict[str, Any], Body()]) -> dict[str, Any]:
        return guarded(lambda: session.update_settings(patch))

    @app.post("/api/run", status_code=202)
    def start() -> dict[str, Any]:
        return guarded(session.start)

    @app.delete("/api/run")
    def stop() -> dict[str, Any]:
        return session.stop()

    @app.get("/api/jobs")
    def jobs() -> dict[str, Any]:
        return {"jobs": session.jobs(), "status": session.status()}

    @app.get("/api/jobs/{key:path}")
    def job(key: str) -> dict[str, Any]:
        return guarded(lambda: session.job(key))

    @app.post("/api/jobs/{key:path}/approve", status_code=202)
    def approve(key: str) -> dict[str, Any]:
        return guarded(lambda: session.approve(key))

    @app.post("/api/jobs/{key:path}/skip")
    def skip(key: str) -> dict[str, Any]:
        return guarded(lambda: session.skip(key))

    @app.post("/api/jobs/{key:path}/submitted")
    def submitted(key: str) -> dict[str, Any]:
        return guarded(lambda: session.mark_submitted(key))

    @app.post("/api/jobs/{key:path}/retry", status_code=202)
    def retry(key: str) -> dict[str, Any]:
        return guarded(lambda: session.retry(key))

    @app.post("/api/jobs/{key:path}/review")
    def review(key: str, decision: Annotated[dict[str, Any], Body()]) -> dict[str, Any]:
        return guarded(lambda: session.decide_review(key, decision))

    @app.post("/api/facts")
    def facts(body: Annotated[dict[str, str], Body()]) -> dict[str, Any]:
        return {"facts": guarded(lambda: session.add_facts(body))}

    @app.post("/api/boards/{board}/login", status_code=202)
    def login(board: str) -> dict[str, Any]:
        return guarded(lambda: session.sign_in(board))

    @app.get("/api/boards")
    def board_states() -> dict[str, Any]:
        return session.board_states()

    @app.get("/api/events")
    def events(request: Request) -> StreamingResponse:
        return StreamingResponse(
            _stream(session, request),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )


def _setup_routes(app: FastAPI, session: Session) -> None:
    """The first run: one mock application, and the questions it turns into a profile."""

    def guarded[T](work) -> T:
        try:
            return work()
        except ControllerError as error:
            raise HTTPException(409, str(error)) from error

    @app.get("/api/setup")
    def state() -> dict[str, Any]:
        return session.setup_state()

    @app.post("/api/setup/probe", status_code=202)
    def probe(body: Annotated[dict[str, Any], Body()] = None) -> dict[str, Any]:  # noqa: RUF013
        body = body or {}
        return guarded(lambda: session.probe(body.get("url", ""), board=body.get("board", "")))

    @app.post("/api/setup/preview")
    def preview(search: Annotated[dict[str, Any], Body()]) -> dict[str, Any]:
        """The first page a search turns up. Nothing is assessed and nothing is recorded."""
        try:
            return guarded(lambda: session.preview(search))
        except ValidationError as error:
            raise HTTPException(400, _first_problem(error)) from error

    @app.post("/api/setup/suggest")
    def suggest() -> dict[str, Any]:
        """Roles the portfolio argues for. Needs the API, the worker and a model; slow."""
        return guarded(session.suggest_searches)

    @app.post("/api/setup/save")
    def save(payload: Annotated[dict[str, Any], Body()]) -> dict[str, Any]:
        return guarded(lambda: session.save_setup(payload))

    @app.post("/api/setup/skip")
    def skip() -> dict[str, Any]:
        return guarded(session.skip_setup)


def _config_routes(app: FastAPI, session: Session) -> None:
    """Reading and writing ``applier.yaml`` — the same file the command line reads."""

    def guarded[T](work) -> T:
        try:
            return work()
        except ControllerError as error:
            raise HTTPException(409, str(error)) from error
        except ConfigError as error:
            raise HTTPException(422, str(error)) from error

    @app.get("/api/config/raw")
    def read_raw() -> dict[str, Any]:
        return guarded(session.read_config_text)

    @app.put("/api/config/raw")
    def write_raw(body: Annotated[dict[str, str], Body()]) -> dict[str, Any]:
        """Validated before anything is written: a config that would not load is refused whole."""
        return guarded(lambda: session.write_config_text(body.get("text", "")))

    @app.patch("/api/profile")
    def profile(patch: Annotated[dict[str, Any], Body()]) -> dict[str, Any]:
        try:
            return guarded(lambda: session.update_profile(patch))
        except ValidationError as error:
            raise HTTPException(400, _first_problem(error)) from error

    @app.put("/api/profile/resume")
    async def upload_resume(request: Request, name: Annotated[str, Query()]) -> dict[str, Any]:
        """The file itself, as the request body: picked on the page, kept by this server."""
        data = await request.body()
        return await anyio.to_thread.run_sync(
            lambda: guarded(lambda: session.store_resume(name, data))
        )

    @app.delete("/api/profile/resume")
    def forget_resume() -> dict[str, Any]:
        return guarded(session.forget_resume)

    @app.get("/api/providers")
    def providers() -> dict[str, Any]:
        return session.providers()

    @app.put("/api/portfolio/token")
    def set_token(body: Annotated[dict[str, str], Body()]) -> dict[str, Any]:
        """Takes the token and keeps it. The answer never contains it."""
        return guarded(lambda: session.set_portfolio_token(body.get("token", "")))

    @app.delete("/api/portfolio/token")
    def forget_token() -> dict[str, Any]:
        return guarded(session.forget_portfolio_token)

    @app.post("/api/sites/{site}/login", status_code=202)
    def sign_in(site: str) -> dict[str, Any]:
        return guarded(lambda: session.sign_in_site(site))

    @app.get("/api/sites")
    def sites() -> dict[str, Any]:
        """Asks whether the configured chat site's saved sign-in still works."""
        return session.site_states()


def _first_problem(error: ValidationError) -> str:
    problem = error.errors()[0]
    where = ".".join(str(part) for part in problem["loc"]) or "that"
    return f"{where}: {problem['msg']}"


def _ledger_routes(app: FastAPI, session: Session) -> None:
    @app.get("/api/history")
    def history(
        status: Annotated[str | None, Query()] = None,
        limit: Annotated[int, Query(ge=1, le=1000)] = 200,
    ) -> dict[str, Any]:
        """Everything the ledger holds — across every run this machine has ever made."""
        try:
            wanted = Status(status) if status else None
        except ValueError as error:
            raise HTTPException(400, f"No such status: {status!r}.") from error

        entries = session.ledger.entries(wanted, limit)
        return {
            "counts": session.ledger.counts(),
            "entries": [
                {
                    "key": entry.key,
                    "board": entry.board,
                    "status": entry.status.value,
                    "title": entry.title,
                    "company": entry.company,
                    "url": entry.url,
                    "reason": entry.reason,
                    "verdict": entry.verdict,
                    "score": entry.score,
                    "questions": entry.questions,
                    "hasReport": entry.report is not None,
                    "hasLetter": bool(entry.letter),
                    "updatedAt": entry.updated_at,
                    "appliedAt": entry.applied_at,
                }
                for entry in entries
            ],
        }

    @app.get("/api/history/{key:path}")
    def entry(key: str) -> dict[str, Any]:
        found = session.ledger.get(key)
        if found is None:
            raise HTTPException(404, "Nothing on record for that posting.")
        return {
            "key": found.key,
            "status": found.status.value,
            "title": found.title,
            "company": found.company,
            "url": found.url,
            "reason": found.reason,
            "report": found.report,
            "letter": found.letter,
            "answers": found.answers,
            "questions": found.questions,
            "artifacts": found.artifacts,
            "updatedAt": found.updated_at,
        }

    @app.get("/api/questions")
    def questions() -> dict[str, Any]:
        """Employer questions no fact answered, most asked first.

        The same digest ``applier questions`` prints, and the thing to work from: a fact
        added for the question at the top of this list unblocks the most applications.
        """
        from collections import Counter

        asked: Counter[str] = Counter()
        where: dict[str, list[dict[str, str]]] = {}

        for record in session.ledger.entries(Status.NEEDS_INPUT, limit=1000):
            for question in record.questions:
                asked[question] += 1
                where.setdefault(question, []).append(
                    {"key": record.key, "title": record.title, "company": record.company or ""}
                )

        return {
            "questions": [
                {"question": question, "times": times, "postings": where.get(question, [])[:10]}
                for question, times in asked.most_common()
            ],
            "facts": dict(session.answerer.facts),
        }


async def _stream(session: Session, request: Request) -> AsyncIterator[str]:
    """One page's subscription, as server-sent events.

    It opens with the whole table and the log so far, so a page that has just loaded — or one
    that dropped and reconnected — is never looking at a partial picture while it waits for
    something to change.

    The wait is short and repeated rather than long and blocking, so that a page which simply
    went away is noticed within a second instead of leaving a thread parked on a queue until
    the next keepalive.
    """
    with session.bus.subscribe() as subscriber:
        yield _sse(
            {
                "kind": "hello",
                "jobs": session.jobs(),
                "log": session.scrollback(),
                "status": session.status(),
                "settings": settings_of(session.config),
                "config": session.describe(),
                "setup": session.setup_state(),
            }
        )

        silent = 0.0

        while True:
            if await request.is_disconnected():
                return

            try:
                event = await anyio.to_thread.run_sync(subscriber.get, True, _BREATH)
            except queue.Empty:
                silent += _BREATH
                if silent >= _KEEPALIVE:
                    silent = 0.0
                    yield ": keepalive\n\n"
                continue

            if event is None:
                return

            silent = 0.0
            yield _sse(event.as_dict())


def _sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, default=str)}\n\n"
