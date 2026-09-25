"""The server, end to end, with no browser and no model.

What matters here is that the page can never be shown something the controller did not say,
and that a press which cannot be honoured says so rather than half-happening. The controller's
own behaviour is pinned down in test_controller; this is the layer over it.
"""

from __future__ import annotations

import asyncio
import json

import pytest
from fastapi.testclient import TestClient

from applier.config import load
from applier.server.app import _stream, create_app
from test_controller import FakeAssessor, FakeBoard, FakeBrowser, listings, write_config


def build(tmp_path):
    """The app, with a board and a browser that are plain objects.

    Nothing is opened until a run is started, so the session the app built can be fitted out
    here and still be the one every route talks to.
    """
    board, browser = FakeBoard(listings(2)), FakeBrowser()
    config = load(write_config(tmp_path))

    app = create_app(config, headless=True)
    session = app.state.session
    session.assessor = FakeAssessor(api=config.portfolio.api)
    session.answerer.answer = lambda handles, *, role: {}
    session._make_board = lambda _name: board
    session._make_browser = lambda _name: browser
    return app, session, board


@pytest.fixture
def client(tmp_path, monkeypatch):
    # Deliberately absent: the controller has to start without one, because the box that
    # asks for it is on the page it would otherwise be unable to serve.
    monkeypatch.delenv("APPLIER_PORTFOLIO_TOKEN", raising=False)
    app, session, board = build(tmp_path)

    with TestClient(app) as opened:
        yield opened, session, board


@pytest.fixture
def session(tmp_path, monkeypatch):
    """The session on its own, for what is tested below the HTTP layer."""
    monkeypatch.delenv("APPLIER_PORTFOLIO_TOKEN", raising=False)
    _, made, _ = build(tmp_path)
    try:
        yield made
    finally:
        made.close()


def test_config_states_what_the_file_holds(client):
    opened, _, _ = client
    body = opened.get("/api/config").json()

    assert body["candidate"]["name"] == "Tester"
    assert [search["keywords"] for search in body["searches"]] == ["python"]
    assert body["settings"]["autoPick"] is True


def test_the_token_can_be_given_to_the_page_and_never_comes_back(client):
    """Pasting it is the point; reading it back is not.

    The page needs to know whether there is a token and where it came from, so that a token
    which is not taking effect can be explained. It never needs the token itself, and a page
    that could read one back is a page that leaks one to anything that can reach the port.
    """
    opened, session, _ = client

    before = opened.get("/api/config").json()
    assert before["portfolio"]["tokenSet"] is False
    assert "a portfolio API token" in before["ready"], "and the page says it is missing"

    opened.put("/api/portfolio/token", json={"token": "pfl_secret_value"})
    after = opened.get("/api/config").json()

    assert after["portfolio"]["tokenSet"] is True
    assert after["portfolio"]["tokenSource"] == "page"
    assert "a portfolio API token" not in after["ready"]
    assert "pfl_secret_value" not in json.dumps(after), "the token itself never comes back"
    # It is live, not merely stored: the next assessment runs under it.
    assert session.assessor.token == "pfl_secret_value"


def test_a_token_that_is_not_one_is_refused(client):
    opened, _, _ = client

    refused = opened.put("/api/portfolio/token", json={"token": "eyJhbGciOi"})

    assert refused.status_code == 422
    assert "pfl_" in refused.json()["detail"]


def test_the_portfolio_api_can_be_pointed_somewhere_else(client):
    """It defaults to the deployed portfolio, and the page may move it.

    Nobody should have to open the config file to run against a portfolio on their own
    machine, and a run already under way should not have to be restarted for it: the
    assessor is holding the address, so it is changed there as well as in the file.
    """
    opened, session, _ = client
    assert session.config.portfolio.api == "https://api.blograg.pbh-dev.tech"

    body = opened.patch("/api/profile", json={"portfolioApi": "http://localhost:5009/"}).json()

    assert body["portfolio"]["api"] == "http://localhost:5009", "the trailing slash goes"
    assert session.assessor.api == "http://localhost:5009", "the next assessment asks there"
    assert "api: http://localhost:5009" in session.config.source_path.read_text()


def test_an_address_that_is_not_one_is_refused(client):
    opened, session, _ = client

    refused = opened.patch("/api/profile", json={"portfolioApi": "api.example.com"})

    assert refused.status_code == 409
    assert "https://" in refused.json()["detail"]
    assert session.assessor.api == "https://api.blograg.pbh-dev.tech", "and nothing moved"


def test_settings_round_trip(client):
    opened, session, _ = client
    body = opened.patch("/api/settings", json={"autoSubmit": False, "minScore": 80}).json()

    assert body["autoSubmit"] is False
    assert body["minScore"] == 80
    assert session.config.run.auto_submit is False
    # And it reached the file: the page and `applier run` read the same settings.
    assert "auto_submit: false" in session.config.source_path.read_text()


def test_starting_without_a_search_is_refused(client):
    opened, _, _ = client
    opened.patch("/api/settings", json={"searches": []})

    refused = opened.post("/api/run")

    assert refused.status_code == 409
    assert "search" in refused.json()["detail"]


def test_pressing_a_button_on_a_posting_that_is_not_there_says_so(client):
    opened, _, _ = client

    refused = opened.post("/api/jobs/fake%3Anope/approve")

    assert refused.status_code == 409
    assert "fake:nope" in refused.json()["detail"]


class Leaving:
    """A page that is there for the first look and gone by the second."""

    def __init__(self) -> None:
        self.looks = 0

    async def is_disconnected(self) -> bool:
        self.looks += 1
        return self.looks > 1


def test_the_event_stream_opens_with_the_whole_picture(session):
    """Two things every page depends on.

    That the first frame carries the whole picture — so a page which has just loaded, or has
    just reconnected after a drop, is never looking at half of one. And that a page which has
    gone away ends the stream, rather than leaving a subscription and a parked thread behind
    it for as long as the session lasts.

    It is driven directly rather than through the test client: the stream is endless by
    design, and reading one frame of it over HTTP would mean never letting go of the response.
    """

    async def drive() -> list[str]:
        return [frame async for frame in _stream(session, Leaving())]  # type: ignore[arg-type]

    frames = asyncio.run(drive())

    assert len(frames) == 1, "a page that left should get the opening frame and nothing more"
    hello = json.loads(frames[0].removeprefix("data: "))
    assert hello["kind"] == "hello"
    assert hello["jobs"] == []
    assert hello["log"] == []
    assert hello["settings"]["autoPick"] is True
    assert hello["status"]["running"] is False


def test_history_is_empty_until_something_happens(client):
    opened, _, _ = client
    body = opened.get("/api/history").json()

    assert body["counts"] == {}
    assert body["entries"] == []


def test_an_unknown_status_filter_is_refused(client):
    opened, _, _ = client

    assert opened.get("/api/history?status=nonsense").status_code == 400


def test_the_question_digest_lists_the_facts_in_use(client):
    opened, _, _ = client
    body = opened.get("/api/questions").json()

    assert body["questions"] == []
    assert body["facts"]["Notice period"] == "1 month"


def test_a_fact_added_from_the_page_reaches_the_answerer(client):
    opened, session, _ = client

    body = opened.post("/api/facts", json={"Expected salary": "SGD 7,000"}).json()

    assert body["facts"]["Expected salary"] == "SGD 7,000"
    assert session.answerer.facts["Expected salary"] == "SGD 7,000"


def test_an_empty_fact_is_refused(client):
    opened, _, _ = client

    assert opened.post("/api/facts", json={"  ": "  "}).status_code == 409
