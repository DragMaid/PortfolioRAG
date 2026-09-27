"""The board's browser putting itself back together.

Camoufox never starts here. What is pinned down is what a person can do to a run by closing
things: the working tab, or the whole window. Neither may stop the run — the next command
gets a tab to drive, in the same window or a relaunched one on the same profile.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from applier.browser import BrowserSession
from applier.errors import BrowserClosedError


class FakePage:
    def __init__(self, context: FakeContext) -> None:
        self.context = context
        self.closed = False

    def is_closed(self) -> bool:
        return self.closed

    def close(self) -> None:
        self.closed = True

    def bring_to_front(self) -> None:
        pass

    def on(self, _event, _handler) -> None:
        pass


class FakeContext:
    """A browser context that only keeps a list of pages, the way a real one does."""

    def __init__(self) -> None:
        self._pages: list[FakePage] = []
        self.gone = False
        self.handlers: dict[str, object] = {}

    @property
    def pages(self) -> list[FakePage]:
        if self.gone:
            from playwright.sync_api import Error

            raise Error("Target page, context or browser has been closed")
        return [page for page in self._pages if not page.closed]

    def new_page(self) -> FakePage:
        page = FakePage(self)
        self._pages.append(page)
        return page

    def on(self, event, handler) -> None:
        self.handlers[event] = handler


def opened(tmp_path: Path, monkeypatch) -> tuple[BrowserSession, list[FakeContext]]:
    """A session whose ``open`` makes a fake context instead of starting camoufox."""
    session = BrowserSession(profile=tmp_path / "p", captures=tmp_path / "c", headless=True)
    contexts: list[FakeContext] = []

    def open_fake() -> BrowserSession:
        context = FakeContext()
        contexts.append(context)
        session._camoufox = object()  # type: ignore[assignment]
        session._attach(context)  # type: ignore[arg-type]
        return session

    monkeypatch.setattr(session, "open", open_fake)
    session.open()
    return session, contexts


def test_a_closed_working_tab_is_replaced_in_the_same_window(tmp_path, monkeypatch):
    session, contexts = opened(tmp_path, monkeypatch)
    first = session.page
    first.close()

    with pytest.raises(BrowserClosedError):
        session.page  # noqa: B018 — a command in flight learns the tab went

    page = session.ensure()

    assert page is not first and not page.is_closed()
    assert len(contexts) == 1, "the window was still there, so it is not relaunched"


def test_a_closed_window_is_relaunched_on_the_same_profile(tmp_path, monkeypatch):
    session, contexts = opened(tmp_path, monkeypatch)
    contexts[0].gone = True

    assert session.alive is False
    page = session.ensure()

    assert len(contexts) == 2, "a new browser is opened"
    assert session.alive is True
    assert not page.is_closed()


def test_the_close_event_alone_is_enough_to_relaunch(tmp_path, monkeypatch):
    """Firefox fires ``close`` on the context when its last window goes."""
    session, contexts = opened(tmp_path, monkeypatch)
    contexts[0].handlers["close"]()  # type: ignore[operator]

    session.ensure()

    assert len(contexts) == 2


def test_nothing_is_relaunched_when_nothing_is_wrong(tmp_path, monkeypatch):
    session, contexts = opened(tmp_path, monkeypatch)
    page = session.page

    assert session.ensure() is page
    assert len(contexts) == 1


def test_tabs_the_board_opened_behind_its_back_are_tidied(tmp_path, monkeypatch):
    """A posting whose apply button carries ``target=_blank`` leaves a page nobody drives."""
    session, contexts = opened(tmp_path, monkeypatch)
    stray = contexts[0].new_page()

    assert session.tidy() == 1
    assert stray.is_closed()
    assert not session.page.is_closed(), "and the working tab is kept"


def test_a_hidden_browser_shows_itself_for_a_person_and_hides_again(tmp_path, monkeypatch):
    session, _ = opened(tmp_path, monkeypatch)
    modes: list[bool] = []
    real_open = session.open

    def open_and_note():
        modes.append(session.headless)
        return real_open()

    monkeypatch.setattr(session, "open", open_and_note)

    session.show("sign in")
    assert session.visible and modes == [False], "relaunched with a window"

    session.settle()
    assert not session.visible and modes == [False, True], "and hidden again after"

    session.settle()
    assert modes == [False, True], "nothing to do when it is already hidden"


def test_a_window_kept_up_on_purpose_is_never_hidden(tmp_path, monkeypatch):
    session, contexts = opened(tmp_path, monkeypatch)
    session.headless = session.hidden = False

    session.show("anything")
    session.settle()

    assert len(contexts) == 1 and session.visible


def test_a_browser_never_opened_says_so(tmp_path):
    session = BrowserSession(profile=tmp_path / "p", captures=tmp_path / "c", headless=True)

    with pytest.raises(BrowserClosedError):
        session.ensure()
    assert session.tidy() == 0


# --- in a real camoufox -------------------------------------------------------


@pytest.mark.browser
def test_a_real_camoufox_survives_its_tab_and_its_window_being_closed(tmp_path):
    """The fakes above assume how Playwright reports a closed tab and a closed browser. This
    checks the assumption against the real thing, on a real persistent profile."""
    session = BrowserSession(profile=tmp_path / "p", captures=tmp_path / "c", headless=True)
    session.open()
    try:
        session.page.set_content("<p id=x>first</p>")

        session.page.close()
        page = session.ensure()
        page.set_content("<p id=x>second</p>")
        assert page.inner_text("#x") == "second", "a new tab in the same window"

        # The window going, as a person closing it would take it.
        session._context.close()  # type: ignore[union-attr]
        assert session.alive is False
        page = session.ensure()
        page.set_content("<p id=x>third</p>")
        assert page.inner_text("#x") == "third", "a relaunched browser on the same profile"
        assert session.alive is True
    finally:
        session.close()
