"""One thread per board, owning that board's browser for as long as the session lasts.

Playwright's sync API binds every object it makes to the thread that made it. So a board is a
thread with a queue in front of it, and everything the server asks of that board — search,
fetch a posting, fill and submit a form, sign in — arrives as a command on that queue.

**Why commands are small.** Discovery could be one long call that walks every search page and
assesses everything it finds. It is not: each listing is a command of its own. That is what
lets the loop come up for air between postings, where a button a person pressed is answered
in a moment rather than after the posting in flight finishes, and where a closed window is
noticed and reopened (``BrowserSession.ensure``) before the next command needs it.

**Why priorities.** A person waiting on a button press should not queue behind forty postings
still to be assessed, and an application that has been picked should go before more discovery.

**Why lanes.** One thread per board meant one thing at a time: a posting being assessed held
up the application behind it, and the pause between two applications held up every
assessment. So a board has several workers (``run.workers``, at least two), each with a
browser of its own, pulling from the board's shared queues:

    lane 0      assesses: searches and postings to assess, and nothing else — so turning up
                and assessing new postings never waits on a form being filled
    lane 1..n   apply; and, when the model can take more than one call at a time, help
                assess while there is nothing to apply to

A button a person pressed goes to lane 0, whose browser is the board's own profile — the
one they signed in to. The other lanes keep profiles of their own, seeded from its cookies.
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

_IDLE = 0.1

_sequence = count()
_here = threading.local()


def current_worker() -> BoardWorker | None:
    """The worker whose thread this is, or None off every board's thread."""
    return getattr(_here, "worker", None)


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
        on_error: Callable[[str, Exception], None],
        log: Callable[[str], None],
        make_browser: Callable[[], BrowserSession] | None = None,
        lane: int = 0,
        sources: Callable[[], list[queue.PriorityQueue[Command]]] = list,
        seed: Callable[[], list[dict] | None] | None = None,
    ):
        self.name = name
        self.lane = lane
        self.log = log
        # The board's shared queues this lane takes work from, in the order it prefers them.
        self._sources = sources
        # Cookies to start with, from lane 0, so a new lane's profile is signed in too.
        self._seed = seed
        self._make_board = make_board
        self._make_browser = make_browser or self._camoufox
        self._profile = profile
        self._captures = captures
        self._headless = headless
        self._on_error = on_error

        self._queue: queue.PriorityQueue[Command] = queue.PriorityQueue()
        self._thread = threading.Thread(target=self._loop, name=f"board-{name}-{lane}", daemon=True)
        self._ready = threading.Event()
        self._stopping = threading.Event()
        self._failure: Exception | None = None

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
        """Runs whatever a person just asked for. Safe only on the worker thread.

        Called from the pause between two applications, when nothing holds the tab, so a
        button pressed then is answered at once rather than after a minute of rate limiting.
        """
        while not self._stopping.is_set():
            try:
                command = self._queue.get_nowait()
            except queue.Empty:
                return

            if command.priority > IMMEDIATE:
                self._queue.put(command)
                return

            self._run(command)

    def _next(self) -> Command | None:
        """This lane's own queue first — a button pressed — then the board's, in order."""
        for source in (self._queue, *self._sources()):
            try:
                return source.get_nowait()
            except queue.Empty:
                continue
        return None

    def _run(self, command: Command) -> None:
        try:
            if self.browser is not None:
                self.browser.ensure()
                self.browser.tidy()
            command.run()
        except Exception as error:
            logger.exception("%s: %s raised.", self.name, command.label)
            self._on_error(self.name, error)
        finally:
            # A window brought up for a sign-in or a bot check goes away with the command
            # that needed it.
            if self.browser is not None:
                try:
                    self.browser.settle()
                except Exception as error:
                    self._on_error(self.name, error)

    def seed(self, cookies: list[dict] | None) -> None:
        """Signs this lane's browser in with another lane's cookies. Never fatal: a lane
        that is still signed out asks for a sign-in the first time it needs one."""
        add = getattr(self.browser, "add_cookies", None)
        if not cookies or add is None:
            return
        try:
            add(cookies)
        except Exception as error:
            self.log(f"{self.name} (lane {self.lane}): could not copy the sign-in: {error}")

    def _camoufox(self) -> BrowserSession:
        return BrowserSession(
            profile=self._profile,
            captures=self._captures,
            headless=self._headless,
            log=self.log,
        ).open()

    def _loop(self) -> None:
        _here.worker = self
        try:
            self.browser = self._make_browser()
            if self._seed is not None:
                self.seed(self._seed())
            self.board = self._make_board()
            self.board.attach(self.browser)
        except Exception as error:
            self._failure = error
            self._ready.set()
            self._on_error(self.name, error)
            return

        self._ready.set()

        while not self._stopping.is_set():
            command = self._next()
            if command is None:
                time.sleep(_IDLE)
                continue
            self._run(command)

        if self.browser is not None:
            self.browser.close()


class BoardLanes:
    """A board's workers, and the queues they share. Lane 0 always assesses."""

    def __init__(
        self, name: str, build: Callable[[int], BoardWorker], *, helps: Callable[[], bool]
    ):
        self.name = name
        self._build = build
        self._helps = helps
        self._assess: queue.PriorityQueue[Command] = queue.PriorityQueue()
        self._apply: queue.PriorityQueue[Command] = queue.PriorityQueue()
        self.workers: list[BoardWorker] = []
        self._lock = threading.Lock()

    @property
    def primary(self) -> BoardWorker:
        return self.workers[0]

    def sources(self, lane: int) -> list[queue.PriorityQueue[Command]]:
        if lane == 0:
            return [self._assess]
        return [self._apply, self._assess] if self._helps() else [self._apply]

    def grow(self, count: int) -> int:
        """Starts lanes until there are ``count``. Returns how many were started."""
        started = 0
        with self._lock:
            while len(self.workers) < count:
                worker = self._build(len(self.workers))
                self.workers.append(worker)
                worker.start()
                started += 1
        return started

    def wait_until_ready(self, timeout: float = 120.0) -> None:
        self.primary.wait_until_ready(timeout)

    def submit(self, priority: int, label: str, run: Callable[[], None]) -> None:
        """A person's button to lane 0; an application to whichever applying lane is free;
        searching and assessing to whichever lane takes it first — lane 0 always does."""
        if priority <= IMMEDIATE:
            self.primary.submit(priority, label, run)
            return
        if self.primary._stopping.is_set():
            return
        target = self._apply if priority == APPLY else self._assess
        target.put(Command(priority=priority, label=label, run=run))

    def clear(self, *, above: int = IMMEDIATE) -> None:
        for worker in self.workers:
            worker.clear(above=above)
        for shared in (self._assess, self._apply):
            while True:
                try:
                    shared.get_nowait()
                except queue.Empty:
                    break

    @property
    def pending(self) -> int:
        own = sum(worker.pending for worker in self.workers)
        return own + self._assess.qsize() + self._apply.qsize()

    def stop(self, timeout: float = 30.0) -> None:
        self.clear(above=-1)
        for worker in self.workers:
            worker._stopping.set()
        for worker in self.workers:
            worker.stop(timeout=timeout)
