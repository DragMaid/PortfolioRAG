"""``/api/ext/*``: what the browser extension fills a page from.

With a fake board, a fake browser and no model. The extension's own behaviour on a page is
pinned down in its own tests; this is the contract it relies on.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from applier.ledger import Status
from test_controller import listings, state_at, wait_for
from test_server import build


def raw(label: str, kind="text", id="f0", options=(), required=False) -> dict:
    return {"id": id, "kind": kind, "label": label, "options": list(options), "required": required}


@pytest.fixture
def ext(tmp_path, monkeypatch):
    monkeypatch.setenv("APPLIER_PORTFOLIO_TOKEN", "pfl_test")
    app, session, board = build(tmp_path)
    with TestClient(app) as client:
        key = client.get("/api/extension").json()["key"]
        client.headers["X-Applier-Key"] = key
        yield client, session, board


def test_every_route_wants_the_pairing_key(ext):
    client, _, _ = ext
    stranger = TestClient(client.app)

    assert stranger.get("/api/ext/status").status_code == 401
    wrong = stranger.get("/api/ext/status", headers={"X-Applier-Key": "ext_nope"})
    assert wrong.status_code == 401
    assert client.get("/api/ext/status").json()["ok"] is True


def test_no_web_page_is_let_read_it(ext):
    """No CORS headers: a page in the same browser cannot read what it sends back."""
    client, _, _ = ext
    answer = client.get("/api/ext/status", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in answer.headers


def test_rotating_the_key_locks_the_old_one_out(ext):
    client, _, _ = ext
    old = client.headers["X-Applier-Key"]
    new = client.post("/api/extension/key").json()["key"]

    assert new != old
    assert client.get("/api/ext/status").status_code == 401


def test_fill_answers_what_it_can_and_lists_the_rest(ext):
    client, session, _ = ext
    session.config.candidate.email = "tester@example.com"
    session.answerer.facts = session.config.candidate.all_facts()
    session.memory.remember(session_field("Notice period"), "1 month")

    body = client.post(
        "/api/ext/fill",
        json={
            "url": "https://careers.example.com/apply",
            "title": "Engineer",
            "fields": [
                raw("Full name", id="a"),
                raw("Email", id="b"),
                raw("Notice period *", id="c"),
                raw("Favourite colour", id="d", required=True),
                raw("Resume", kind="file", id="e"),
            ],
        },
    ).json()

    assert body["answers"] == {"a": "Tester", "b": "tester@example.com", "c": "1 month"}
    assert body["sources"] == {"a": "fact", "b": "fact", "c": "memory"}
    assert [one["id"] for one in body["unknown"]] == ["d"], "a file input is not a question"
    assert body["job"] is None


def test_an_answer_given_in_the_panel_is_remembered(ext):
    client, _, _ = ext
    question = raw("Favourite colour", id="d")

    saved = client.post("/api/ext/remember", json={"field": question, "answer": "Blue"})
    assert saved.status_code == 200

    body = client.post("/api/ext/fill", json={"fields": [question], "useModel": False}).json()
    assert body["answers"] == {"d": "Blue"}
    assert client.get("/api/ext/memory").json()["answers"][0]["label"] == "Favourite colour"


def test_an_answer_that_is_not_an_option_is_refused(ext):
    client, _, _ = ext
    question = raw("Right to work?", kind="radio", options=["Yes", "No"])

    refused = client.post("/api/ext/remember", json={"field": question, "answer": "Maybe"})
    assert refused.status_code == 409


def test_forgetting_an_answer(ext):
    client, _, _ = ext
    client.post("/api/ext/remember", json={"field": raw("Colour"), "answer": "Blue"})

    assert client.delete("/api/ext/memory", params={"key": "Colour"}).json()["forgotten"]
    assert client.get("/api/ext/memory").json()["answers"] == []


def test_the_resume_is_served_only_when_there_is_a_file(ext, tmp_path):
    client, session, _ = ext
    assert client.get("/api/ext/resume").status_code == 409

    resume = tmp_path / "Ada_Resume.pdf"
    resume.write_bytes(b"%PDF-1.4 fake")
    session.update_profile({"resume": {"upload": str(resume)}})

    served = client.get("/api/ext/resume")
    assert served.status_code == 200
    assert served.content == b"%PDF-1.4 fake"
    assert "Ada_Resume.pdf" in served.headers["content-disposition"]


def test_a_manual_queue_page_is_recognised_anywhere_in_its_apply_flow(ext):
    client, session, _ = ext
    session.update_settings({"searches": [0], "applyMode": "manual"})
    session.start()
    wait_for(lambda: state_at(session, "fake:0") == "manual", "it should be queued")

    for url in (
        "https://fake/job/0/apply",
        "https://fake/job/0/apply/review?step=3",
        "https://fake/job/0",
    ):
        job = client.get("/api/ext/job", params={"url": url}).json()["job"]
        assert job is not None and job["key"] == "fake:0", url

    assert client.get("/api/ext/job", params={"url": "https://fake/job/01"}).json()["job"] is None
    letter = client.get("/api/ext/jobs/fake:0/letter").json()["letter"]
    assert letter.startswith("Dear hiring manager")


def test_i_sent_it_from_the_extension_settles_the_row(ext):
    client, session, _ = ext
    session.update_settings({"searches": [0], "applyMode": "manual"})
    session.start()
    wait_for(lambda: state_at(session, "fake:0") == "manual", "it should be queued")

    assert client.post("/api/ext/jobs/fake:0/submitted").status_code == 200
    assert state_at(session, "fake:0") == "applied"
    assert session.ledger.get("fake:0").status is Status.APPLIED


def test_a_manual_row_from_an_earlier_session_can_be_settled_too(ext):
    client, session, _ = ext
    session.ledger.record(listings(3)[2], Status.MANUAL, apply_url="https://fake/job/2/apply")

    assert client.post("/api/ext/jobs/fake:2/submitted").status_code == 200
    assert session.ledger.get("fake:2").status is Status.APPLIED


def session_field(label: str):
    from applier.models import FormField

    return FormField(id="x", kind="text", label=label)
