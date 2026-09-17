"""Driving the Gemini, Claude and ChatGPT web apps from a signed-in browser.

For evaluating the pipeline without an API key; see ``rag.providers.web`` and
``eval/run.py --local``. Not used by the worker.
"""

from .errors import (
    BrowserClosedError,
    BrowserLaunchError,
    ChallengeError,
    ComposerNotFoundError,
    LoginRequiredError,
    RateLimitedError,
    ResponseTimeoutError,
    SiteError,
    WebChatError,
)
from .paths import webchat_root
from .session import BROWSERS, Browser, Reply, WebChatSession
from .sites import SITES, ChatSite, get_site

__all__ = [
    "BROWSERS",
    "SITES",
    "Browser",
    "BrowserClosedError",
    "BrowserLaunchError",
    "ChallengeError",
    "ChatSite",
    "ComposerNotFoundError",
    "LoginRequiredError",
    "RateLimitedError",
    "Reply",
    "ResponseTimeoutError",
    "SiteError",
    "WebChatError",
    "WebChatSession",
    "get_site",
    "webchat_root",
]
