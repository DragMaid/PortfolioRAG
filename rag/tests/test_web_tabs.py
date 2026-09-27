"""The web provider's tabs: several callers answered side by side, from one browser thread.

A fake session stands in for the browser. What is pinned down is the scheduling — every
browser call on the one thread, as many conversations in flight as there are tabs and no
more, and a follow-up sent back to its own conversation's tab.
"""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace

import pytest

from rag.providers import web as web_module
from rag.webchat import Reply


class FakeSession:
    """Replies after a few checks, and remembers who touched it from where."""

    # Checks before a reply is finished.
    polls = 3

    def __init__(self, *_args, **_kwargs):
        self.threads: set[int] = set()
        self.in_flight = 0
        self.most_in_flight = 0
        self.sent: list[tuple[int, str]] = []
        self.closed = False
        self.opened = True

    def open(self):
        return self

    @property
    def is_open(self) -> bool:
        return self.opened and not self.closed

    def close(self) -> None:
        self.closed = True

    def tab(self, index: int):
        self.threads.add(threading.get_ident())
        return index

    def send(self, prompt, *, new_chat, timeout, page):
        self.threads.add(threading.get_ident())
        self.sent.append((page, prompt))
        self.in_flight += 1
        self.most_in_flight = max(self.most_in_flight, self.in_flight)
        return SimpleNamespace(page=page, prompt=prompt, checks=0)

    def check(self, pending):
        self.threads.add(threading.get_ident())
        pending.checks += 1
        if pending.checks < self.polls:
            return None
        self.in_flight -= 1
        return Reply(text=f"re: {pending.prompt} (tab {pending.page})")


@pytest.fixture
def provider(monkeypatch):
    sessions: list[FakeSession] = []

    def make(*args, **kwargs):
        sessions.append(FakeSession(*args, **kwargs))
        return sessions[-1]

    monkeypatch.setattr(web_module, "WebChatSession", make)
    monkeypatch.setattr(web_module, "_TICK", 0.01)
    made: list[web_module.WebProvider] = []

    def build(tabs: int) -> tuple[web_module.WebProvider, list[FakeSession]]:
        made.append(web_module.WebProvider(tabs=tabs, log=lambda _message: None))
        return made[-1], sessions

    yield build

    for one in made:
        one.close()


def ask_all(web, prompts: list[str]) -> list[str]:
    with ThreadPoolExecutor(max_workers=len(prompts)) as pool:
        return list(pool.map(lambda prompt: web.ask("gemini", prompt).text, prompts))


def test_callers_are_answered_side_by_side_in_tabs_of_their_own(provider):
    web, sessions = provider(tabs=3)
    replies = ask_all(web, ["a", "b", "c"])

    assert sorted(reply.split(" (")[0] for reply in replies) == ["re: a", "re: b", "re: c"]
    session = sessions[0]
    assert session.most_in_flight == 3
    assert {tab for tab, _ in session.sent} == {0, 1, 2}
    assert len(session.threads) == 1, "every browser call on the provider's own thread"
    assert threading.get_ident() not in session.threads


def test_never_more_conversations_than_tabs(provider):
    web, sessions = provider(tabs=2)
    replies = ask_all(web, ["a", "b", "c", "d", "e"])

    assert len(replies) == 5
    assert sessions[0].most_in_flight == 2


def test_one_tab_is_one_at_a_time(provider):
    web, sessions = provider(tabs=1)
    ask_all(web, ["a", "b", "c"])
    assert sessions[0].most_in_flight == 1


def test_a_follow_up_goes_back_to_its_own_tab(provider):
    web, _ = provider(tabs=3)
    barrier = threading.Barrier(3)
    tabs: dict[str, tuple[int, int]] = {}

    def conversation(name: str) -> None:
        barrier.wait()
        first = web.ask("gemini", f"{name}-1").text
        second = web.ask("gemini", f"{name}-2", new_chat=False).text
        tabs[name] = (int(first[-2]), int(second[-2]))

    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(conversation, ["x", "y", "z"]))

    assert all(first == second for first, second in tabs.values()), tabs


def test_a_follow_up_with_no_conversation_is_refused(provider):
    from rag.webchat import SiteError

    web, _ = provider(tabs=2)
    with pytest.raises(SiteError, match="no conversation to follow up"):
        web.ask("gemini", "and then?", new_chat=False)


def test_closing_fails_what_is_still_waiting(provider):
    import time

    from rag.webchat import SiteError

    web, sessions = provider(tabs=1)
    FakeSession.polls = 10_000
    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            waiting = pool.submit(web.ask, "gemini", "slow")
            deadline = time.monotonic() + 5
            while not (sessions and sessions[0].sent) and time.monotonic() < deadline:
                time.sleep(0.01)
            web.close()
            with pytest.raises(SiteError, match="closed"):
                waiting.result(timeout=5)
    finally:
        FakeSession.polls = 3
