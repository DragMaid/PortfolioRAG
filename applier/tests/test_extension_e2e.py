"""The browser extension, end to end: a real Chromium, the built extension, a live controller.

Everything the extension does is exercised against it for real — the service worker's pairing
and its requests to ``applier serve``, the content script reading and filling pages on another
origin, the side panel asking about what nothing answered, remembering it, the resume upload,
a manual-queue posting filling itself, and a link-out's employer form inheriting its posting.
Only the model is fake, and the board, which none of this touches.

Needs ``npm run build`` in ``applier/extension`` and a Chromium at ``/usr/bin/chromium`` (or
``$APPLIER_CHROMIUM``); skipped otherwise. Run with ``uv run pytest -m browser``.
"""

from __future__ import annotations

import http.server
import os
import shutil
import socket
import threading
import time
from pathlib import Path

import pytest
import uvicorn

from applier.ledger import Status
from applier.models import Listing
from test_server import build

pytestmark = pytest.mark.browser

EXTENSION = Path(__file__).parents[1] / "extension" / "dist"
CHROMIUM = os.environ.get("APPLIER_CHROMIUM") or shutil.which("chromium") or "/usr/bin/chromium"

FORM = """<!doctype html><title>Apply — Acme</title>
<header><input aria-label="Search jobs"></header>
<form id="apply">
  <label for="name">Full name</label><input id="name" required>
  <label for="email">Email address</label><input id="email" type="email" required>
  <label for="python">Years of Python experience</label><input id="python" type="number">
  <label for="colour">Favourite colour *</label><input id="colour" required>
  <fieldset><legend>Do you need sponsorship?</legend>
    <label><input type="radio" name="sp" value="y"> Yes</label>
    <label><input type="radio" name="sp" value="n"> No</label>
  </fieldset>
  <label for="cv">Upload your resume</label><input id="cv" type="file">
  <label for="letter">Cover letter</label><textarea id="letter"></textarea>
</form>"""

# Inputs as a framework keeps them, and a second step that only appears after the first.
STEPS = """<!doctype html><title>Apply in steps</title>
<form id="apply">
  <label for="first">First name</label><input id="first">
  <button type="button" id="next">Next</button>
  <div id="step2"></div>
</form>
<p id="state"></p>
<script>
  // React's trick, reduced: state follows only a change the DOM shows and the tracker has not.
  const native = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  const state = {};
  function control(input) {
    let tracked = input.value;
    Object.defineProperty(input, "value", {
      configurable: true,
      get() { return native.get.call(this); },
      set(v) { tracked = v; native.set.call(this, v); },
    });
    input.addEventListener("input", () => {
      const shown = native.get.call(input);
      if (shown !== tracked) { tracked = shown; state[input.id] = shown; }
      document.getElementById("state").textContent = JSON.stringify(state);
    });
  }
  control(document.getElementById("first"));
  document.getElementById("next").addEventListener("click", () => {
    document.getElementById("step2").innerHTML =
      '<label for="notice">Notice period</label><input id="notice">' +
      '<label for="city">City</label><input id="city">';
    control(document.getElementById("notice"));
    control(document.getElementById("city"));
  });
</script>"""

POSTING = """<!doctype html><title>Engineer — Board</title>
<main><h1>Engineer</h1><p>A posting that links out.</p>
<a id="out" href="/employer/apply" target="_blank">Apply on company site</a></main>"""

EMPLOYER = """<!doctype html><title>Employer ATS</title>
<form><label for="n">Full name</label><input id="n">
<label for="e">Email</label><input id="e"></form>"""


def free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


@pytest.fixture
def site(tmp_path):
    """The pages to apply on, served from an origin of their own, as a real employer's are."""
    root = tmp_path / "site"
    for path, body in {
        "form.html": FORM,
        "steps.html": STEPS,
        "job/7/apply/index.html": FORM,
        "job/8/index.html": POSTING,
        "employer/apply/index.html": EMPLOYER,
    }.items():
        (root / path).parent.mkdir(parents=True, exist_ok=True)
        (root / path).write_text(body, encoding="utf-8")

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root), **kwargs)

        def log_message(self, format, *args):
            pass

    server = http.server.ThreadingHTTPServer(("127.0.0.1", free_port()), Quiet)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()


@pytest.fixture
def controller(tmp_path, monkeypatch):
    """``applier serve``, live on a port, with a model that knows one thing."""
    monkeypatch.setenv("APPLIER_PORTFOLIO_TOKEN", "pfl_test")
    app, session, _board = build(tmp_path)
    session.config.candidate.email = "tester@example.com"
    session.answerer.facts = session.config.candidate.all_facts() | {"Python": "5 years"}

    asked: list[list[str]] = []

    def model(handles, *, role, facts=None):
        asked.append([handle.field.label for handle in handles])
        return {
            handle.field.id: "5"
            for handle in handles
            if "python" in handle.field.label.lower()
        } | {
            handle.field.id: "No"
            for handle in handles
            if "sponsorship" in handle.field.label.lower()
        }

    session.answerer.answer = model
    resume = tmp_path / "Tester_Resume.pdf"
    resume.write_bytes(b"%PDF-1.4 a resume")
    session.update_profile({"resume": {"upload": str(resume)}})

    port = free_port()
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="error"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.monotonic() + 15
    while not server.started and time.monotonic() < deadline:
        time.sleep(0.05)

    yield {"url": f"http://127.0.0.1:{port}", "session": session, "asked": asked}

    server.should_exit = True
    thread.join(timeout=10)


@pytest.fixture
def chromium(tmp_path, controller):
    if not (EXTENSION / "manifest.json").is_file():
        pytest.skip("Build the extension first: cd applier/extension && npm run build")
    if not Path(CHROMIUM).exists():
        pytest.skip(f"No Chromium at {CHROMIUM}")

    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            str(tmp_path / "profile"),
            executable_path=CHROMIUM,
            headless=os.environ.get("APPLIER_HEADED") != "1",
            args=[
                f"--disable-extensions-except={EXTENSION}",
                f"--load-extension={EXTENSION}",
            ],
        )
        worker = context.service_workers[0] if context.service_workers else None
        worker = worker or context.wait_for_event("serviceworker", timeout=15_000)
        extension_id = worker.url.split("/")[2]

        key = controller["session"].secrets.extension_key
        worker.evaluate(
            "([backend, key]) => chrome.storage.local.set({ backend, key })",
            [controller["url"], key],
        )

        yield {"context": context, "worker": worker, "id": extension_id}
        context.close()


def tab_id(chromium, url: str) -> int:
    return chromium["worker"].evaluate(
        "async (url) => (await chrome.tabs.query({})).find((tab) => tab.url === url)?.id",
        url,
    )


def panel_for(chromium, url: str):
    """The side panel, opened as a page pinned to the tab being filled."""
    panel = chromium["context"].new_page()
    panel.goto(f"chrome-extension://{chromium['id']}/panel.html?tab={tab_id(chromium, url)}")
    panel.get_by_text("Connected to applier").wait_for(timeout=10_000)
    return panel


def value(page, selector: str) -> str:
    return page.eval_on_selector(selector, "(el) => el.value")


def test_fill_remember_and_upload(chromium, controller, site):
    """Press Fill; everything known is filled, the one unknown is asked, and kept."""
    form = chromium["context"].new_page()
    form.goto(f"{site}/form.html")
    form.wait_for_load_state("domcontentloaded")
    panel = panel_for(chromium, form.url)

    panel.locator("#fill").click()
    unknown = panel.locator("li[data-field]").filter(has_text="Favourite colour")
    unknown.wait_for(timeout=20_000)

    assert value(form, "#name") == "Tester"
    assert value(form, "#email") == "tester@example.com"
    assert value(form, "#python") == "5", "the model's answer, citing a fact"
    assert form.is_checked("input[name=sp][value=n]")
    assert value(form, "header input") == "", "the site's search box is left alone"
    assert form.eval_on_selector("#cv", "(el) => el.files[0]?.name") == "Tester_Resume.pdf"
    assert value(form, "#colour") == ""

    # The unknown, answered in the panel and remembered.
    unknown.locator("input[name^=answer]").fill("Blue")
    unknown.get_by_role("button", name="Save").click()
    form.wait_for_function("() => document.querySelector('#colour').value === 'Blue'")
    remembered = controller["session"].memory.get("Favourite colour")
    assert remembered is not None and remembered.answer == "Blue"

    # A second visit to the same form: no model needed for what was answered before.
    controller["asked"].clear()
    form.reload()
    form.wait_for_load_state("domcontentloaded")
    panel.locator("#fill").click()
    form.wait_for_function(
        "() => document.querySelector('#colour').value === 'Blue'", timeout=20_000
    )
    assert all("Favourite colour" not in labels for labels in controller["asked"])


def test_a_framework_form_that_grows_a_step(chromium, controller, site):
    """React-style inputs take the value, and a step that appears later is filled on its own."""
    from applier.models import FormField

    controller["session"].memory.remember(
        FormField(id="x", kind="text", label="Notice period"), "1 month"
    )
    page = chromium["context"].new_page()
    page.goto(f"{site}/steps.html")
    panel = panel_for(chromium, page.url)

    panel.locator("#fill").click()
    page.wait_for_function(
        "() => document.querySelector('#first').value === 'Tester'", timeout=20_000
    )
    page.wait_for_function("() => document.querySelector('#state').textContent.includes('Tester')")

    page.click("#next")
    page.wait_for_function(
        "() => document.querySelector('#notice')?.value === '1 month'", timeout=20_000
    )
    assert "1 month" in page.text_content("#state"), "the framework saw the change"
    panel.get_by_text("City").wait_for(timeout=10_000)


def test_a_manual_queue_posting_fills_itself_and_is_settled(chromium, controller, site):
    session = controller["session"]
    listing = Listing(board="fake", job_id="7", url=f"{site}/job/7", title="Engineer")
    session.ledger.record(
        listing,
        Status.MANUAL,
        reason="yours to send",
        letter="Dear Acme, I would like to work with you.",
        apply_url=f"{site}/job/7/apply",
        report={"verdict": "strong", "score": 88, "headline": "A good fit."},
    )

    page = chromium["context"].new_page()
    page.goto(f"{site}/job/7/apply/")
    # Nobody pressed anything: a page from the queue fills itself.
    page.wait_for_function(
        "() => document.querySelector('#email').value === 'tester@example.com'", timeout=20_000
    )

    panel = panel_for(chromium, page.url)
    panel.get_by_text("Engineer").first.wait_for()
    panel.get_by_role("button", name="Insert cover letter").click()
    page.wait_for_function(
        "() => document.querySelector('#letter').value.startsWith('Dear Acme')", timeout=10_000
    )

    panel.get_by_role("button", name="I sent it").click()
    panel.get_by_text("recorded as sent").wait_for(timeout=10_000)
    assert session.ledger.get("fake:7").status is Status.APPLIED


def test_a_link_out_is_followed_to_the_employers_form(chromium, controller, site):
    session = controller["session"]
    listing = Listing(board="fake", job_id="8", url=f"{site}/job/8", title="Engineer")
    session.ledger.record(listing, Status.MANUAL, apply_url=f"{site}/job/8")

    posting = chromium["context"].new_page()
    posting.goto(f"{site}/job/8/")
    with chromium["context"].expect_page() as opened:
        posting.click("#out")
    employer = opened.value

    employer.wait_for_function(
        "() => document.querySelector('#e').value === 'tester@example.com'", timeout=20_000
    )
    assert value(employer, "#n") == "Tester"
