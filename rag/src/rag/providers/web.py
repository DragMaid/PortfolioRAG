"""A signed-in chat web app standing in for an API key. For local evaluation only.

The "model" is a site name — ``gemini``, ``claude`` or ``chatgpt`` — and each call opens a
fresh conversation in that site through ``rag.webchat``, so stages and cases cannot see each
other's context.

Structured output is a prompt and a parser: the JSON Schema is appended to the prompt, the
reply's code blocks (then its text) are scanned for a JSON object that validates, and a
reply that does not is answered in the same conversation with the validation error, up to
``repair_attempts`` times.

Two honest limits, which the eval records rather than hides:

* no seed, no effort, no max_tokens — the site decides, so runs vary;
* no usage metadata. Token counts are estimated at four characters a token so the reports
  still show relative load, and the cost is zero because no key is billed.

Not registered in the provider registry: a stored credential can never select it, so no
author's key can put a browser in a deployed worker's request path. The one thing that does
drive a browser is ``rag.local`` — a service the author runs on their own machine, against
their own sign-ins.
"""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from langchain_core.prompt_values import PromptValue
from langchain_core.runnables import Runnable, RunnableLambda
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from rag.webchat import SITES, Browser, Reply, WebChatError, WebChatSession, get_site

from .base import Effort, ModelPrice

_FREE = ModelPrice(Decimal("0"), Decimal("0"))

# NOTE: trying to simulate the json schema feature from the API
_JSON_INSTRUCTIONS = """\


---
Answer with a single JSON object that conforms to the JSON Schema below. Put it in one \
```json code block and write nothing outside it. Do not use tools, web search, canvas or \
artifacts.

<json_schema>
{schema}
</json_schema>\
"""

_REPAIR_PROMPT = """\
That reply could not be used: {error}

Reply again with only the corrected JSON object, in one ```json code block, conforming to \
the schema given above.\
"""


class WebProvider:
    """Sessions per site, opened on first use and shared by every model built from them.

    Sharing is required, not an optimisation: the browser profile holds a lock, so two
    sessions on one profile cannot run at once — and the pipeline builds two models.
    """

    name = "web"

    def __init__(
        self,
        *,
        browser: Browser = "camoufox",
        headless: bool = True,
        output_dir: Path | None = None,
        chrome_path: str = "chromium",
        login_timeout: float = 300,
        repair_attempts: int = 1,
        log=print,
    ):
        self.browser = browser
        self.headless = headless
        self.output_dir = output_dir
        self.chrome_path = chrome_path
        self.login_timeout = login_timeout
        self.repair_attempts = repair_attempts
        self.log = log
        self._sessions: dict[str, WebChatSession] = {}

    @property
    def default_model(self) -> str:
        return "claude"

    def price(self, _model: str) -> ModelPrice | None:
        return _FREE

    def build(
        self,
        *,
        api_key: str = "",
        model: str,
        max_tokens: int = 0,
        effort: Effort = "medium",
        timeout: float = 300,
        max_retries: int = 1,
        seed: int | None = None,
    ) -> BaseChatModel:
        get_site(model)
        return WebChatModel(site=model, web=self, timeout=timeout, max_retries=max_retries)

    def structured(self, model: BaseChatModel, schema: type) -> Runnable:
        if not isinstance(model, WebChatModel):
            raise TypeError("WebProvider.structured needs a model built by WebProvider.")
        if not (isinstance(schema, type) and issubclass(schema, BaseModel)):
            raise TypeError("WebProvider.structured supports pydantic schemas only.")

        instructions = _JSON_INSTRUCTIONS.format(
            schema=json.dumps(schema.model_json_schema(), indent=2)
        )

        def run(value: PromptValue | list[BaseMessage] | str) -> dict[str, Any]:
            prompt = render_prompt(_messages(value)) + instructions
            reply = model.ask(prompt, new_chat=True)
            # Simulate raw message object returned by lanchain if ran with stream_raw=True
            raw = _ai_message(prompt, reply)

            try:
                return {"raw": raw, "parsed": parse_reply(reply, schema), "parsing_error": None}
            except ValueError as error:
                parsing_error: Exception = error

            # If the prompt does not follow format then re-prompt to repair
            for _ in range(self.repair_attempts):
                repair = _REPAIR_PROMPT.format(error=_short(parsing_error))
                reply = model.ask(repair, new_chat=False)
                # Incresase the usage metadata and expand from both to end metadata response
                raw = _combine(raw, _ai_message(repair, reply))

                try:
                    return {"raw": raw, "parsed": parse_reply(reply, schema), "parsing_error": None}
                except ValueError as error:
                    parsing_error = error

            return {"raw": raw, "parsed": None, "parsing_error": parsing_error}

        # Langchain function to convert python function to runnable chain component
        return RunnableLambda(run, name=f"web_structured_{schema.__name__}")

    def session(self, site: str) -> WebChatSession:
        key = get_site(site).name.lower()
        session = self._sessions.get(key)

        if session is None or not session.is_open:
            # One profile, one browser: another site's session must close before this opens.
            self.close()
            session = WebChatSession(
                SITES[key],
                browser=self.browser,
                headless=self.headless,
                output_dir=self.output_dir,
                chrome_path=self.chrome_path,
                login_timeout=self.login_timeout,
                log=self.log,
            ).open()
            self._sessions[key] = session

        return session

    def set_output_dir(self, output_dir: Path) -> None:
        """Where conversations and error captures go from now on, open sessions included."""
        self.output_dir = output_dir
        for session in self._sessions.values():
            session.output_dir = output_dir

    def close(self) -> None:
        for session in self._sessions.values():
            session.close()
        self._sessions.clear()


class WebChatModel(BaseChatModel):
    """A LangChain chat model whose every call is one prompt in a browser tab."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    site: str
    web: WebProvider = Field(exclude=True)
    timeout: float = 300
    max_retries: int = 1

    @property
    def _llm_type(self) -> str:
        return "webchat"

    @property
    def _identifying_params(self) -> dict[str, Any]:
        return {"site": self.site, "browser": self.web.browser, "headless": self.web.headless}

    def ask(self, prompt: str, *, new_chat: bool) -> Reply:
        """One prompt, with retryable failures retried in a fresh conversation.

        A follow-up cannot be retried in a fresh conversation — it would lose what it is
        following up — so its failures go straight to the caller.
        """
        attempts = 1 + (max(0, self.max_retries) if new_chat else 0)

        for attempt in range(1, attempts + 1):
            try:
                return self.web.session(self.site).ask(
                    prompt, new_chat=new_chat, timeout=self.timeout
                )
            except WebChatError as error:
                if not error.retryable or attempt == attempts:
                    raise
                self.web.log(f"{error.site}: {error.message} — retrying ({attempt}/{attempts - 1})")

        raise AssertionError("unreachable")

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager=None,
        **kwargs: Any,
    ) -> ChatResult:
        prompt = render_prompt(messages)
        reply = self.ask(prompt, new_chat=True)
        return ChatResult(generations=[ChatGeneration(message=_ai_message(prompt, reply))])


def render_prompt(messages: list[BaseMessage]) -> str:
    """A chat window takes one message, so the system prompt is folded into it."""
    parts: list[str] = []

    for message in messages:
        text = message.text if isinstance(message.text, str) else str(message.content)

        if isinstance(message, SystemMessage):
            parts.append(f"<instructions>\n{text}\n</instructions>")
        elif isinstance(message, HumanMessage):
            parts.append(text)
        else:
            parts.append(
                f"<previous_{message.type}_message>\n{text}\n</previous_{message.type}_message>"
            )

    return "\n\n".join(parts)


def parse_reply[T: BaseModel](reply: Reply, schema: type[T]) -> T:
    """The first JSON object in the reply that validates, code blocks before prose.

    Raises ValueError (which ValidationError is) with the most useful failure: a validation
    error on a real object says more than "no JSON found".
    """
    best_error: ValueError | None = None

    for source in [*reply.code_blocks, reply.text]:
        # Largest first: a nested object also decodes on its own and would validate less.
        for candidate in sorted(_json_objects(source), key=len, reverse=True):
            try:
                return schema.model_validate_json(candidate)
            except ValidationError as error:
                best_error = best_error if isinstance(best_error, ValidationError) else error

    if best_error is not None:
        raise best_error

    raise ValueError("the reply contained no JSON object")


def _json_objects(text: str) -> list[str]:
    decoder = json.JSONDecoder()
    found: list[str] = []
    index = text.find("{")

    while index != -1:
        try:
            value, end = decoder.raw_decode(text, index)
        except json.JSONDecodeError:
            index = text.find("{", index + 1)
            continue

        if isinstance(value, dict):
            found.append(text[index:end])
        index = text.find("{", end)

    return found


def _messages(value: PromptValue | list[BaseMessage] | str) -> list[BaseMessage]:
    if isinstance(value, PromptValue):
        return value.to_messages()
    if isinstance(value, str):
        return [HumanMessage(value)]
    return list(value)


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def _ai_message(prompt: str, reply: Reply) -> AIMessage:
    input_tokens = _estimate_tokens(prompt)
    output_tokens = _estimate_tokens(reply.text)

    return AIMessage(
        content=reply.text,
        usage_metadata={
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
        },
        response_metadata={"usage_estimated": True, "duration_ms": reply.duration_ms},
    )


def _combine(first: AIMessage, second: AIMessage) -> AIMessage:
    """One raw message for a stage that took a repair turn, so its usage is counted once."""
    a, b = first.usage_metadata or {}, second.usage_metadata or {}
    usage = {
        key: a.get(key, 0) + b.get(key, 0)
        for key in ("input_tokens", "output_tokens", "total_tokens")
    }

    return AIMessage(
        content=second.content,
        usage_metadata=usage,  # type: ignore[arg-type]
        response_metadata={**second.response_metadata, "repaired": True},
    )


def _short(error: Exception, limit: int = 1500) -> str:
    text = str(error)
    return text if len(text) <= limit else text[:limit] + " ..."
