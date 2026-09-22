"""What the page is told, as it happens.

One in-process fan-out: the board threads publish, and every open page holds a subscription
that the server drains into a server-sent-events stream. Subscribers are independent and
bounded — a page that stops reading (a laptop lid closed mid-run) fills its own queue and is
dropped from that point on, rather than holding the run up or growing without limit.
"""

from __future__ import annotations

import contextlib
import queue
import threading
import time
from collections.abc import Generator
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Literal

Kind = Literal["job", "log", "settings", "run", "review", "boards"]

# Deep enough to ride out a slow render or a paused tab, short enough that a page which
# stopped reading is noticed rather than buffered for ever.
_DEPTH = 512


@dataclass(frozen=True, slots=True)
class Event:
    kind: Kind
    data: dict[str, Any] = field(default_factory=dict)
    at: float = field(default_factory=time.time)

    def as_dict(self) -> dict[str, Any]:
        return {"kind": self.kind, "at": self.at, **self.data}


class Bus:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._subscribers: set[queue.Queue[Event | None]] = set()

    def publish(self, kind: Kind, **data: Any) -> None:
        event = Event(kind, data)
        with self._lock:
            subscribers = list(self._subscribers)

        for subscriber in subscribers:
            try:
                subscriber.put_nowait(event)
            except queue.Full:
                # The reader has stopped draining. Wake it with the sentinel so its stream
                # closes and the page reconnects onto a fresh, empty subscription.
                self.drop(subscriber)

    def drop(self, subscriber: queue.Queue[Event | None]) -> None:
        with self._lock:
            self._subscribers.discard(subscriber)
        with contextlib.suppress(queue.Full):
            subscriber.put_nowait(None)

    @contextmanager
    def subscribe(self) -> Generator[queue.Queue[Event | None]]:
        subscriber: queue.Queue[Event | None] = queue.Queue(maxsize=_DEPTH)
        with self._lock:
            self._subscribers.add(subscriber)
        try:
            yield subscriber
        finally:
            with self._lock:
                self._subscribers.discard(subscriber)

    def close(self) -> None:
        """Ends every open stream, so the server's shutdown is not held by a reader."""
        # NOTE: by doing this, _lock only used to reset self._subscribers
        with self._lock:
            subscribers, self._subscribers = list(self._subscribers), set()

        for subscriber in subscribers:
            # NOTE: a simple try - except block which catch queue.Full exception
            with contextlib.suppress(queue.Full):
                subscriber.put_nowait(None)
