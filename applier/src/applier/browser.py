"""The job board's browser: camoufox, with a persistent profile per board.

Separate from the chat site's browser in ``rag.webchat`` on purpose. Each board keeps its
own signed-in profile under ``<state_dir>/profiles/<board>``, and the two browsers run side
by side — the model reads a posting in one while the other holds the posting open.

**Tabs.** A run has one working tab that every board command drives, and any number of
*named* tabs held open beside it. That is what the controller hands an application off
through: the form is filled up to its review page in a tab of its own, the working tab moves
on to the next posting, and the named tab stays exactly where a person left off — theirs to
read, to submit, or to close. ``focus`` brings one to the front when the table's *Show tab*
button is pressed.

Everything else that turns up in the window is litter — a posting whose apply button opens
itself in a new tab, an interstitial, a tracker's popup — and ``reap`` closes it between
commands, so the run stays a window a person can actually read.

Every Playwright object here belongs to the thread that opened the browser. Nothing in this
module is safe to call from anywhere else; see ``controller.worker`` for the loop that owns it.
"""

from __future__ import annotations

import contextlib
import json
import time
import traceback
from collections import deque
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

from playwright.sync_api import BrowserContext, Page
from playwright.sync_api import Error as PlaywrightError

from .errors import ApplierError, BrowserClosedError


class Timeout(Exception):
    """A poll ran out. Converted into an ApplierError by whoever was waiting."""


class BrowserSession:
    def __init__(
        self,
        *,
        profile: Path,
        captures: Path,
        headless: bool,
        log: Callable[[str], None] = print,
    ):
        self.profile = profile
        self.captures = captures
        self.headless = headless
        self.log = log
        self._camoufox = None
        self._context: BrowserContext | None = None
        self._page: Page | None = None
        self._working: Page | None = None
        self._tabs: dict[str, Page] = {}
        self._console: deque[str] = deque(maxlen=100)

    def open(self) -> BrowserSession:
        from camoufox.sync_api import Camoufox

        self.profile.mkdir(parents=True, exist_ok=True)
        manager = Camoufox(
            persistent_context=True,
            user_data_dir=str(self.profile),
            headless=self.headless,
            i_know_what_im_doing=True,
        )

        try:
            context = manager.__enter__()
        except Exception as error:
            text = str(error).strip().rstrip(".")
            hint = (
                "Download the browser with: uv run camoufox fetch"
                if "camoufox fetch" in text or "not installed" in text
                else f"If another window is using {self.profile}, close it first"
            )
            raise BrowserClosedError(f"Could not start camoufox: {text}. {hint}.") from error

        self._camoufox = manager
        self._context = context
        page = context.pages[0] if context.pages else context.new_page()
        self._watch(page)
        self._page = self._working = page
        return self

    def _watch(self, page: Page) -> None:
        """Used to catch debug logs and errors."""
        page.on("console", lambda m: self._console.append(f"{m.type}: {m.text}"))
        page.on("pageerror", lambda e: self._console.append(f"pageerror: {e}"))

    def close(self) -> None:
        if self._camoufox is not None:
            with contextlib.suppress(Exception):
                self._camoufox.__exit__(None, None, None)
        self._camoufox = self._context = self._page = self._working = None
        self._tabs.clear()

    def __enter__(self) -> BrowserSession:
        return self.open()

    def __exit__(self, *_) -> None:
        self.close()

    @property
    def page(self) -> Page:
        """The tab board commands drive: the working tab, or whichever one ``on`` selected."""
        if self._page is None or self._page.is_closed():
            raise BrowserClosedError("The job board's browser is not open.")
        return self._page

    @property
    def tabs(self) -> list[str]:
        """The named tabs still open, forgetting any the person closed themselves."""
        for name in [name for name, page in self._tabs.items() if page.is_closed()]:
            del self._tabs[name]
        return list(self._tabs)

    def open_tab(self, name: str) -> Page:
        """A named tab, created on first use. Reopened if it was closed."""
        page = self._tabs.get(name)

        if page is None or page.is_closed():
            if self._context is None:
                raise BrowserClosedError("The job board's browser is not open.")
            page = self._context.new_page()
            self._watch(page)
            self._tabs[name] = page

        return page

    def has_tab(self, name: str) -> bool:
        return name in self.tabs

    @contextlib.contextmanager
    def on(self, name: str | None):
        """Runs a block against a named tab, with ``page`` pointing at it throughout.

        Board adapters only ever reach for ``browser.page``, so this is the whole of what it
        takes to run an unchanged apply flow in a tab of its own.
        """
        if name is None:
            yield self.page
            return

        page = self.open_tab(name)
        previous = self._page
        self._page = page
        try:
            yield page
        finally:
            # The tab may have been closed under us; falling back to the working tab keeps
            # the next command from raising about a page nobody asked for.
            self._page = previous if previous is not None and not previous.is_closed() else None
            if self._page is None:
                self._page = self._working

    def focus(self, name: str) -> bool:
        """Brings a named tab to the front of the window. False if it is no longer open."""
        page = self._tabs.get(name)
        if page is None or page.is_closed():
            self._tabs.pop(name, None)
            return False

        with contextlib.suppress(PlaywrightError):
            page.bring_to_front()
        return True

    def close_tab(self, name: str) -> None:
        page = self._tabs.pop(name, None)
        if page is not None and not page.is_closed():
            with contextlib.suppress(PlaywrightError):
                page.close()
        if self._page is not None and self._page.is_closed():
            self._page = self._working

    def focus_working(self) -> bool:
        """Brings the working tab to the front: what to show while a form is being filled."""
        if self._working is None or self._working.is_closed():
            return False
        with contextlib.suppress(PlaywrightError):
            self._working.bring_to_front()
        return True

    def reap(self) -> int:
        """Closes every tab nothing asked for, and returns how many went.

        Boards open tabs this never named: a posting whose apply button carries
        ``target=_blank``, an interstitial, a tracker that pops a window and leaves it. None
        of them is ever driven again — board commands only reach for ``page`` — so they pile
        up in front of the person for the length of a run. The working tab and the named ones
        are the whole of what this window is for; anything else is litter.
        """
        if self._context is None:
            return 0

        keep = {id(page) for page in self._tabs.values()}
        if self._working is not None:
            keep.add(id(self._working))
        if self._page is not None:
            keep.add(id(self._page))

        closed = 0
        for page in list(self._context.pages):
            if id(page) in keep or page.is_closed():
                continue
            with contextlib.suppress(PlaywrightError):
                page.close()
                closed += 1

        # A window with nothing left in it is a browser that looks shut. If the working tab
        # was the one the person closed, the next command opens another rather than raising.
        if self._working is None or self._working.is_closed():
            with contextlib.suppress(PlaywrightError):
                self._working = self._context.new_page()
                self._watch(self._working)
            if self._page is None or self._page.is_closed():
                self._page = self._working

        return closed

    def goto(self, url: str, *, settle_ms: int = 1500) -> None:
        try:
            self.page.goto(url, wait_until="domcontentloaded", timeout=60_000)
        except PlaywrightError as error:
            if self._page is None or self._page.is_closed():
                raise BrowserClosedError(f"The browser closed opening {url}.") from error
            raise
        # SPA boards render after DOMContentLoaded; a short settle beats a selector race.
        self.page.wait_for_timeout(settle_ms)

    def poll[T](self, check: Callable[[], T], timeout: float, interval: float = 0.5) -> T:
        """Calls ``check`` until it returns something truthy. Mid-navigation errors retry."""
        deadline = time.monotonic() + timeout

        while time.monotonic() < deadline:
            try:
                if result := check():
                    return result
            except PlaywrightError:
                if self._page is None or self._page.is_closed():
                    raise
            time.sleep(interval)

        raise Timeout

    def fail[E: ApplierError](self, error: E, cause: BaseException | None = None) -> E:
        """Captures the page onto ``error``, then hands it back to be raised."""
        error.artifacts = self.capture(type(error).__name__, error.message, cause)
        return error

    def capture(self, label: str, message: str = "", cause: BaseException | None = None) -> Path:
        stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ")
        directory = self.captures / f"{stamp}_{_slug(label)}"
        directory.mkdir(parents=True, exist_ok=True)

        details: dict[str, object] = {
            "label": label,
            "message": message,
            "captured_at": stamp,
            "cause": "".join(traceback.format_exception(cause)) if cause else None,
        }

        page = self._page
        if page is not None and not page.is_closed():
            for name, grab in (
                ("url", lambda: page.url),
                ("title", lambda: page.title()),
                ("page.html", lambda: (directory / "page.html").write_text(page.content())),
                (
                    "screenshot.png",
                    lambda: page.screenshot(path=directory / "screenshot.png", full_page=True),
                ),
            ):
                try:
                    value = grab()
                    if name in ("url", "title"):
                        details[name] = value
                except Exception as error:
                    details.setdefault("capture_failures", {})[name] = str(error)  # type: ignore[index]

        details["console"] = list(self._console)
        (directory / "capture.json").write_text(json.dumps(details, indent=2, default=str))
        return directory


def _slug(text: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in text.lower()).strip("-")[:60]
