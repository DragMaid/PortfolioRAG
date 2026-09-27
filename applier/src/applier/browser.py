"""The job board's browser: camoufox, with a persistent profile per board.

Separate from the chat site's browser in ``rag.webchat``. Each board keeps its own signed-in
profile under ``<state_dir>/profiles/<board>``.

**One tab.** Everything this browser does is unattended — searching, reading postings, and
filling and submitting a board's own form — so it needs exactly one tab, and it has exactly
one. Applying by hand happens in the person's own browser, with the extension, never here.

**Hidden until it needs you.** With ``headless`` on, the browser runs with no window at all,
and ``show`` brings one up — the same profile, at the same address — only when a person has
something to do in it: sign in, or clear a bot check. ``settle`` hides it again once the
command that needed them is over.

**It heals.** A person can close that tab, or the whole window, at any moment. ``ensure``
is called before every command and puts back whatever is missing: a fresh tab in the same
window, or a relaunched browser on the same profile (so the sign-in survives). A command
that was cut off mid-way raises :class:`BrowserClosedError`; the controller records that
one posting as an error to retry, and the run carries on.

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
        self.hidden = headless
        self.log = log
        self._camoufox = None
        self._context: BrowserContext | None = None
        self._page: Page | None = None
        self._context_closed = False
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
        self._attach(context)
        return self

    def _attach(self, context: BrowserContext) -> None:
        """Attach the current context, set watcher and auto update upon close."""
        self._context = context
        self._context_closed = False
        context.on("close", lambda *_: setattr(self, "_context_closed", True))
        page = context.pages[0] if context.pages else context.new_page()
        self._watch(page)
        self._page = page

    def _watch(self, page: Page) -> None:
        """Used to catch debug logs and errors."""
        page.on("console", lambda m: self._console.append(f"{m.type}: {m.text}"))
        page.on("pageerror", lambda e: self._console.append(f"pageerror: {e}"))

    def close(self) -> None:
        if self._camoufox is not None:
            with contextlib.suppress(Exception):
                self._camoufox.__exit__(None, None, None)
        self._camoufox = self._context = self._page = None

    def __enter__(self) -> BrowserSession:
        return self.open()

    def __exit__(self, *_) -> None:
        self.close()

    @property
    def alive(self) -> bool:
        """Whether the window is still there. Only a real call can tell for certain."""
        if self._context is None or self._context_closed:
            return False
        try:
            # This .pages access automatically check for the session liveness
            self._context.pages  # noqa: B018 — raises once the browser has gone
        except PlaywrightError:
            return False
        return True

    def ensure(self) -> Page:
        """The working tab, put back if a person closed it — or the whole window.

        Called before every command. Cheap when nothing is wrong, which is almost always.
        """
        if not self.alive:
            if self._camoufox is None and self._context is None:
                raise BrowserClosedError("The job board's browser was never opened.")
            self._relaunch()

        elif self._page is None or self._page.is_closed():
            context = self._context
            assert context is not None
            live = [page for page in context.pages if not page.is_closed()]
            try:
                self._page = live[0] if live else context.new_page()
                self._watch(self._page)
            except PlaywrightError:
                self._relaunch()

        return self.page

    def _relaunch(self) -> None:
        self.log("The board's browser was closed; opening it again.")
        self.close()
        self.open()

    @property
    def visible(self) -> bool:
        return not self.headless

    def show(self, why: str) -> None:
        """Brings up a window for a person, where the page they need is.

        A headless browser cannot become a headed one, so it is relaunched on the same
        profile — cookies, sign-in and a cleared bot check all carry over — and sent back to
        the address it was at.
        """
        if not self.headless:
            self.front()
            return
        address = self._address()
        self.log(f"Opening the board's window: {why}.")
        self.close()
        self.headless = False
        self.open()
        if address:
            with contextlib.suppress(PlaywrightError, BrowserClosedError):
                self.goto(address)
        self.front()

    def settle(self) -> None:
        """Hides the window again, if it was only shown for a person. Between commands."""
        if self.hidden and not self.headless:
            self.close()
            self.headless = True
            self.open()

    def _address(self) -> str:
        with contextlib.suppress(Exception):
            if self._page is not None and not self._page.is_closed():
                url = self._page.url
                return url if url.startswith("http") else ""
        return ""

    @property
    def interrupted(self) -> bool:
        """Whether the tab or the window is gone — what to blame a command's failure on."""
        return not self.alive or self._page is None or self._page.is_closed()

    @property
    def page(self) -> Page:
        """The one tab board commands drive."""
        if self._page is None or self._page.is_closed():
            raise BrowserClosedError("The job board's tab was closed.")
        return self._page

    def cookies(self) -> list[dict]:
        """The profile's cookies, for signing another lane's browser in with them."""
        if self._context is None:
            return []
        return list(self._context.cookies())

    def add_cookies(self, cookies: list[dict]) -> None:
        if self._context is not None and cookies:
            self._context.add_cookies(cookies)  # type: ignore[arg-type]

    def front(self) -> None:
        """Brings the window forward, for a sign-in or a bot check a person has to see."""
        with contextlib.suppress(PlaywrightError, BrowserClosedError):
            self.page.bring_to_front()

    def tidy(self) -> int:
        """Closes every tab but the working one, and returns how many went."""
        if not self.alive or self._context is None:
            return 0

        closed = 0
        for page in list(self._context.pages):
            if page is self._page or page.is_closed():
                continue
            with contextlib.suppress(PlaywrightError):
                page.close()
                closed += 1
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
