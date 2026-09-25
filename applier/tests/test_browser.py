"""Tab bookkeeping in :class:`~applier.browser.BrowserSession`.

Camoufox never starts here. What is pinned down is the one thing a person watching a run
actually sees: how many tabs are in front of them. A board opens the ones it is told to and
a board's own pages open ones nobody asked for, and only the second kind may be closed.
"""

from __future__ import annotations

from pathlib import Path

from applier.browser import BrowserSession


class FakePage:
    def __init__(self, context: FakeContext) -> None:
        self.context = context
        self.closed = False
        self.fronted = 0

    def is_closed(self) -> bool:
        return self.closed

    def close(self) -> None:
        self.closed = True

    def bring_to_front(self) -> None:
        self.fronted += 1

    def on(self, _event, _handler) -> None:
        pass


class FakeContext:
    """A browser context that only keeps a list of pages, the way a real one does."""

    def __init__(self) -> None:
        self.pages: list[FakePage] = []

    def new_page(self) -> FakePage:
        page = FakePage(self)
        self.pages.append(page)
        return page


def opened(tmp_path: Path) -> tuple[BrowserSession, FakeContext]:
    session = BrowserSession(profile=tmp_path / "p", captures=tmp_path / "c", headless=True)
    context = FakeContext()
    session._context = context  # type: ignore[assignment]
    session._page = session._working = context.new_page()  # type: ignore[assignment]
    return session, context


def test_a_tab_nobody_named_is_closed_and_the_named_ones_are_not(tmp_path):
    """The whole point of reaping, and the whole risk in it.

    A posting whose apply button carries ``target=_blank`` leaves a page behind that no
    command will ever drive again — one per application, over a run of forty. A tab holding
    a filled-in form for someone to send is the opposite: closing it throws away the
    application and the only record of what was answered.
    """
    session, context = opened(tmp_path)
    handed_over = session.open_tab("fake:1")
    stray = context.new_page()

    assert session.reap() == 1
    assert stray.is_closed(), "the tab the board opened behind our back should go"
    assert not handed_over.is_closed(), "the tab being handed over should not"
    assert session.tabs == ["fake:1"]
    assert not session.page.is_closed(), "and the working tab should still be there"


def test_reaping_spares_whichever_tab_is_being_driven(tmp_path):
    """``on`` points ``page`` at a named tab, and a tick can reap while it does."""
    session, _ = opened(tmp_path)

    with session.on("fake:2") as page:
        session.reap()
        assert not page.is_closed()
        assert session.page is page


def test_a_working_tab_the_person_closed_is_replaced(tmp_path):
    """Closing the last tab should not end the run: the next command opens another."""
    session, context = opened(tmp_path)
    session._working.close()  # type: ignore[union-attr]

    session.reap()

    assert not session.page.is_closed()
    assert session.focus_working() is True
    assert len(context.pages) == 2


def test_reaping_an_unopened_browser_does_nothing(tmp_path):
    session = BrowserSession(profile=tmp_path / "p", captures=tmp_path / "c", headless=True)

    assert session.reap() == 0
