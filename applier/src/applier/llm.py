"""The model, whichever it is, answering several calls at once.

Model work — a job-fit pipeline, a cover letter, a batch of employer questions — runs on a
small pool, so each of a board's lanes can have a call in flight and an assessment never
waits for a cover letter to finish.

With the ``web`` provider that still means one browser: a chat site's profile can only be
open once. It is ``rag``'s ``WebProvider`` that makes it several conversations, one per tab,
all driven from the provider's own browser thread (Playwright allows no other); a call from
any pool thread just waits for its tab's reply. ``tabs`` is how many, and the controller
keeps it at one per lane.

The one-thread executor that is left is for the things that take as long as a person does:
signing in to a chat site, in a window of its own.
"""

from __future__ import annotations

import threading
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel
from rag.cover_letter import CoverLetterPipeline
from rag.pipeline import JobFitPipeline
from rag.providers import ChatProvider, get_provider
from rag.providers.web import WebProvider
from rag.settings import Settings

from .config import LlmConfig
from .errors import ApplierError

# Calls an API provider may have in flight at once. Threads are only made when used, so this
# is a ceiling, not a cost; in practice it is one per board lane.
MAX_PARALLEL = 8


class ModelError(ApplierError):
    """A model call failed or answered in the wrong shape."""


class Llm:
    def __init__(
        self,
        config: LlmConfig,
        settings: Settings,
        *,
        log: Callable[[str], None],
        tabs: int = 1,
    ):
        self.config = config
        self.settings = settings
        self.log = log
        self._tabs = max(1, min(MAX_PARALLEL, tabs))
        self._thread = ThreadPoolExecutor(max_workers=1, thread_name_prefix="llm")
        self._pool = ThreadPoolExecutor(max_workers=MAX_PARALLEL, thread_name_prefix="llm-call")
        self._building = threading.Lock()
        self._provider: ChatProvider | WebProvider | None = None
        self._api_key = config.api_key()

    @property
    def model_name(self) -> str:
        if self.config.provider == "web":
            return self.config.site
        return self.config.model or self.provider.default_model

    @property
    def parallel(self) -> bool:
        """Whether more than one call can be answered at a time. An API always can; a chat
        site can when it has more than one tab to answer in."""
        return self.config.provider != "web" or self._tabs > 1

    @property
    def tabs(self) -> int:
        return self._tabs

    @tabs.setter
    def tabs(self, count: int) -> None:
        """Conversations the chat site may hold at once. Takes effect from its next prompt."""
        self._tabs = max(1, min(MAX_PARALLEL, count))
        if isinstance(self._provider, WebProvider):
            self._provider.tabs = self._tabs

    @property
    def provider(self) -> ChatProvider | WebProvider:
        """Built lazily, on whichever thread asks first; none of it touches a browser yet."""
        with self._building:
            return self._build_provider()

    def _build_provider(self) -> ChatProvider | WebProvider:
        if self._provider is None:
            if self.config.provider == "web":
                self._provider = WebProvider(
                    browser=self.config.browser,
                    headless=self.config.headless,
                    login_timeout=600 if not self.config.headless else 90,
                    tabs=self._tabs,
                    log=self.log,
                )
            else:
                self._provider = get_provider(self.config.provider)
        return self._provider

    def call[T](self, work: Callable[..., T], *args: Any, **kwargs: Any) -> T:
        """Runs ``work`` on the pool and waits for it."""
        return self._pool.submit(work, *args, **kwargs).result()

    def submit(self, work: Callable[..., Any], *args: Any) -> None:
        """Queues ``work`` on the model thread without waiting for it.

        For the things that take as long as a person does — signing in to a chat site, above
        all. A request that waited for that would be holding a connection open for ten
        minutes; the page hears how it went on the event stream instead.
        """
        self._thread.submit(work, *args)

    def release(self) -> None:
        """Closes the chat site's browser. Safe from any thread.

        A profile can only be open once, so anything that needs to drive that browser itself
        — a sign-in, in a window where somebody can type — has to be given it first. The
        provider reopens on its next use, so releasing it costs a page load and nothing else.
        """
        if isinstance(self._provider, WebProvider):
            self._provider.close()
        self._provider = None

    def reset(self) -> None:
        """Close the current session / chat and re-apply new api key."""
        self.release()
        try:
            self._api_key = self.config.api_key()
        except ApplierError as error:
            self.log(str(error))
            self._api_key = ""

    def job_fit(self) -> JobFitPipeline:
        return JobFitPipeline(
            settings=self.settings,
            provider=self.provider,
            api_key=self._api_key,
            model=self.model_name,
        )

    def cover_letter(self) -> CoverLetterPipeline:
        return CoverLetterPipeline(
            settings=self.settings,
            provider=self.provider,
            api_key=self._api_key,
            model=self.model_name,
        )

    def structured[T: BaseModel](
        self, prompt: ChatPromptTemplate, inputs: dict[str, Any], schema: type[T]
    ) -> T:
        """One prompt, one validated object. Call on the model thread."""
        model: BaseChatModel = self.provider.build(
            api_key=self._api_key,
            model=self.model_name,
            max_tokens=self.settings.max_tokens,
            effort=self.settings.extraction_effort,
            timeout=self.settings.request_timeout_seconds,
            max_retries=self.settings.max_retries,
            seed=self.settings.llm_seed,
        )
        chain = prompt | self.provider.structured(model, schema)

        try:
            result = chain.invoke(inputs)
        except Exception as error:
            raise ModelError(f"The model call failed: {error}") from error

        parsed = result.get("parsed") if isinstance(result, dict) else result
        if not isinstance(parsed, schema):
            reason = result.get("parsing_error") if isinstance(result, dict) else None
            raw = result.get("raw") if isinstance(result, dict) else None
            text = raw.content if isinstance(raw, AIMessage) else ""
            raise ModelError(f"The model answered in the wrong shape ({reason}): {text!s:.300}")

        return parsed

    def close(self, timeout: float = 60.0) -> None:
        """Closes the chat site's browser, waiting at most ``timeout`` for it.

        Never on the model thread: that may be holding a sign-in window open for ten
        minutes, and closing must not wait for a person. Nothing queued is started.
        """
        self._thread.shutdown(wait=False, cancel_futures=True)
        self._pool.shutdown(wait=False, cancel_futures=True)
        if isinstance(self._provider, WebProvider):
            self._provider.close(timeout=timeout)
        self._provider = None
