"""One thread per board, owning that board's browser for as long as the session lasts.

Playwright's sync API binds every object it makes to the thread that made it, and a board's
browser holds tabs that outlive the command that opened them. So a board is a thread with a
queue in front of it, and everything the server asks of that board — search a page, fetch a
posting, fill a form, bring a tab to the front — arrives as a command on that queue.

**Why commands are small.** Discovery could be one long call that walks every search page and
assesses everything it finds. It is not: each search page enqueues the next, and each listing
is a command of its own. That is what lets the loop come up for air between postings, which
is where it notices that a tab it handed over has had its application sent, and where a person
pressing *Show tab* is answered in a moment rather than after the posting in flight finishes.

**Why priorities.** A person waiting on a button press should not queue behind forty postings
still to be assessed, and an application that has been picked should go before more discovery.
"""

from __future__ import annotations

import logging
import queue
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from itertools import count
from pathlib import Path

from ..boards.base import JobBoard
from ..browser import BrowserSession

logger = logging.getLogger(__name__)

# Lower goes first.
IMMEDIATE = 0  # a button the person just pressed
APPLY = 10  # an application that has been picked
PROCESS = 20  # fetch and assess one posting
DISCOVER = 30  # turn up more postings

_IDLE = 0.25
_TICK_EVERY = 2.0

_sequence = count()


@dataclass(order=True)
class Command:
    priority: int
    sequence: int = field(default_factory=lambda: next(_sequence))
    label: str = field(compare=False, default="")
    run: Callable[[], None] = field(compare=False, default=lambda: None)


class BoardWorker:
    """A board, its browser and its queue. Every attribute below is the thread's alone."""

    def __init__(
        self,
        name: str,
        *,
        make_board: Callable[[], JobBoard],
        profile: Path,
        captures: Path,
        headless: bool,
        tick: Callable[[BoardWorker], None],
        on_error: Callable[[str, Exception], None],
        log: Callable[[str], None],
        make_browser: Callable[[], BrowserSession] | None = None,
    ):
        self.name = name
        self.log = log
        self._make_board = make_board
        self._make_browser = make_browser or self._camoufox
        self._profile = profile
        self._captures = captures
        self._headless = headless
        self._tick = tick
        self._on_error = on_error

        self._queue: queue.PriorityQueue[Command] = queue.PriorityQueue()
        self._thread = threading.Thread(target=self._loop, name=f"board-{name}", daemon=True)
        self._ready = threading.Event()
        self._stopping = threading.Event()
        self._failure: Exception | None = None
        self._last_tick = 0.0

        self.board: JobBoard | None = None
        self.browser: BrowserSession | None = None

    def start(self) -> None:
        self._thread.start()

    def submit(self, priority: int, label: str, run: Callable[[], None]) -> None:
        """Queues work. Dropped once the worker is stopping, so shutdown is not open-ended."""
        if self._stopping.is_set():
            return
        self._queue.put(Command(priority=priority, label=label, run=run))

    def clear(self, *, above: int = IMMEDIATE) -> None:
        """Drops everything queued at a lower priority than ``above``. What *Stop* does.

        Whatever is in flight finishes — a form halfway through is worse abandoned than
        completed — and nothing further is started.
        """
        kept: list[Command] = []
        while True:
            try:
                command = self._queue.get_nowait()
            except queue.Empty:
                break
            if command.priority <= above:
                kept.append(command)
        for command in kept:
            self._queue.put(command)

    @property
    def pending(self) -> int:
        return self._queue.qsize()

    def stop(self, timeout: float = 30.0) -> None:
        self.clear(above=-1)
        self._stopping.set()
        self._thread.join(timeout=timeout)

    def wait_until_ready(self, timeout: float = 120.0) -> None:
        """Blocks until the browser is up, and re-raises here whatever stopped it coming up."""
        self._ready.wait(timeout)
        if self._failure is not None:
            raise self._failure

    def pump(self) -> None:
        """Lets the session look at this board's tabs. Safe only on the worker thread.

        Called between commands, and from inside anything that waits on a person, so a
        hand-off can settle itself while the loop is otherwise blocked.
        """
        now = time.monotonic()
        if now - self._last_tick < _TICK_EVERY:
            return
        self._last_tick = now

        try:
            self._tick(self)
        except Exception as error:  # a tick must never take the worker down
            logger.exception("The %s tick raised.", self.name)
            self._on_error(self.name, error)

    def _camoufox(self) -> BrowserSession:
        return BrowserSession(
            profile=self._profile,
            captures=self._captures,
            headless=self._headless,
            log=self.log,
        ).open()

    def _loop(self) -> None:
        try:
            self.browser = self._make_browser()
            self.board = self._make_board()
            self.board.attach(self.browser)
        except Exception as error:
            self._failure = error
            self._ready.set()
            self._on_error(self.name, error)
            return

        self._ready.set()

        while not self._stopping.is_set():
            self.pump()
            try:
                command = self._queue.get(timeout=_IDLE)
            except queue.Empty:
                continue

            try:
                command.run()
            except Exception as error:
                logger.exception("%s: %s raised.", self.name, command.label)
                self._on_error(self.name, error)

        if self.browser is not None:
            self.browser.close()
