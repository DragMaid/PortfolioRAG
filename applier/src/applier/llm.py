"""The model, whichever it is, on a thread of its own.

Playwright's sync API cannot run two browsers from one thread, and with the ``web``
provider there are two: the chat site answering, and the job board being applied to. So
everything that touches the model is submitted to one dedicated thread and waited on — the
same arrangement ``rag.local.runs`` makes for the same reason. With an API provider the
thread is simply unnecessary, and harmless.
"""

from __future__ import annotations

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


class ModelError(ApplierError):
    """A model call failed or answered in the wrong shape."""


class Llm:
    def __init__(self, config: LlmConfig, settings: Settings, *, log: Callable[[str], None]):
        self.config = config
        self.settings = settings
        self.log = log
        self._thread = ThreadPoolExecutor(max_workers=1, thread_name_prefix="llm")
        self._provider: ChatProvider | WebProvider | None = None
        self._api_key = config.api_key()

    @property
    def model_name(self) -> str:
        if self.config.provider == "web":
            return self.config.site
        return self.config.model or self.provider.default_model

    @property
    def provider(self) -> ChatProvider | WebProvider:
        """Built lazily and only ever used on the model thread."""
        if self._provider is None:
            if self.config.provider == "web":
                self._provider = WebProvider(
                    browser=self.config.browser,
                    headless=self.config.headless,
                    login_timeout=600 if not self.config.headless else 90,
                    log=self.log,
                )
            else:
                self._provider = get_provider(self.config.provider)
        return self._provider

    def call[T](self, work: Callable[..., T], *args: Any, **kwargs: Any) -> T:
        """Runs ``work`` on the model thread and waits for it."""
        return self._thread.submit(work, *args, **kwargs).result()

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

    def close(self) -> None:
        def shut() -> None:
            if isinstance(self._provider, WebProvider):
                self._provider.close()
            self._provider = None

        self._thread.submit(shut).result()
        self._thread.shutdown(wait=True)
