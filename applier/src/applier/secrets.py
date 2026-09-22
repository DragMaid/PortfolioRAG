"""Credentials, kept out of the config file.

``applier.yaml`` is meant to be readable, diffable and shareable — it is the file you hand
someone when they ask how this is set up. So nothing secret goes in it, and the config only
ever names the environment variable a credential could come from.

That left one thing unreasonable: the portfolio API token. It is needed before anything can
be assessed, and demanding it in the environment means the page cannot start at all until
you have found it, exported it and restarted — which is exactly the kind of up-front setup
the rest of this was rewritten to remove. So it can be pasted in, and is kept here:

    <state_dir>/secrets.yaml      mode 0600, inside the already-gitignored .applier/

A token pasted on the page wins over one in the environment. The failure this avoids is the
quiet one: pasting a fresh token because the exported one expired, and having nothing change.

Provider API keys are deliberately *not* here. Those stay environment-only, because unlike
the portfolio token they are worth real money if they leak, and nothing about this tool
needs them before it can start.
"""

from __future__ import annotations

import os
import stat
from pathlib import Path
from typing import Any, Literal

import yaml

from .errors import ConfigError

# Where a token in use came from. The page says which, so that a token that is not taking
# effect can be explained rather than puzzled over.
Source = Literal["page", "environment"]

_FILE = "secrets.yaml"


class Secrets:
    """The credentials this machine holds, for one state directory."""

    def __init__(self, state_dir: Path, *, token_env: str):
        self.path = state_dir / _FILE
        self.token_env = token_env
        self._values: dict[str, Any] = self._read()

    def _read(self) -> dict[str, Any]:
        if not self.path.is_file():
            return {}
        try:
            loaded = yaml.safe_load(self.path.read_text(encoding="utf-8")) or {}
        except yaml.YAMLError:
            return {}
        return loaded if isinstance(loaded, dict) else {}

    def _write(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        # Written before the mode is set, so the window where it exists world-readable is
        # closed by creating it that way in the first place.
        private = stat.S_IRUSR | stat.S_IWUSR
        handle = os.open(self.path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, private)
        with os.fdopen(handle, "w", encoding="utf-8") as file:
            file.write("# Written by applier. Not for sharing, and not part of applier.yaml.\n")
            yaml.safe_dump(self._values, file, sort_keys=True)
        os.chmod(self.path, private)

    @property
    def portfolio_token(self) -> str:
        """The token to run retrieval under, or empty. Never raises: the page asks for it."""
        stored = str(self._values.get("portfolio_token") or "").strip()
        return stored or os.environ.get(self.token_env, "").strip()

    @property
    def portfolio_source(self) -> Source | None:
        if str(self._values.get("portfolio_token") or "").strip():
            return "page"
        return "environment" if os.environ.get(self.token_env, "").strip() else None

    def set_portfolio_token(self, value: str) -> None:
        token = value.strip()
        if not token.startswith("pfl_"):
            raise ConfigError(
                "That does not look like a portfolio API token. They begin with pfl_ and are "
                "issued in the studio's access tab, with the write scope. A studio session "
                "token will not do."
            )

        self._values["portfolio_token"] = token
        self._write()

    def forget_portfolio_token(self) -> None:
        """Drops the stored token. Whatever is in the environment takes over again."""
        self._values.pop("portfolio_token", None)
        self._write()

    def describe(self) -> dict[str, Any]:
        """What the page is told. Never the token itself."""
        return {
            "tokenSet": bool(self.portfolio_token),
            "tokenSource": self.portfolio_source,
            "tokenVariable": self.token_env,
            "storedAt": str(self.path),
        }


def required(secrets: Secrets) -> str:
    """The token, for somewhere that cannot stop and ask — the command line.

    ``applier serve`` never calls this: a missing token there is a box on the page, not a
    reason to refuse to start.
    """
    if token := secrets.portfolio_token:
        return token

    raise ConfigError(
        f"No portfolio API token. Either export one as ${secrets.token_env} (pfl_…, write "
        f"scope, from the studio's access tab), or paste it into `applier serve`, which keeps "
        f"it in {secrets.path}."
    )
