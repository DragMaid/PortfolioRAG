"""Logging that can be read by a person at a terminal or by a log shipper.

Structured either way: every record carries the job it belongs to, so a single analysis can
be followed across the six stages it passes through.
"""

from __future__ import annotations

import json
import logging
import sys
from typing import Any

# The attributes `logging` puts on every record. Anything outside this set was added by a
# call site through `extra=`, which is exactly what the JSON formatter should emit.
_STANDARD_ATTRIBUTES = frozenset(
    logging.LogRecord("", 0, "", 0, "", None, None).__dict__
) | {"message", "asctime", "taskName"}


class JsonFormatter(logging.Formatter):
    """One JSON object per line, with whatever the call site attached."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        for key, value in record.__dict__.items():
            if key not in _STANDARD_ATTRIBUTES:
                payload[key] = value

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, default=str)


class ContextFormatter(logging.Formatter):
    """The same information, laid out for a human reading a terminal."""

    def format(self, record: logging.LogRecord) -> str:
        base = super().format(record)

        context = {
            key: value
            for key, value in record.__dict__.items()
            if key not in _STANDARD_ATTRIBUTES
        }

        if not context:
            return base

        rendered = " ".join(f"{key}={value}" for key, value in context.items())
        return f"{base}  [{rendered}]"


def configure_logging(level: str = "INFO", as_json: bool = False) -> None:
    """Installs the one handler this process uses. Safe to call twice."""
    handler = logging.StreamHandler(sys.stdout)

    handler.setFormatter(
        JsonFormatter()
        if as_json
        else ContextFormatter("%(asctime)s %(levelname)-7s %(name)-22s %(message)s", "%H:%M:%S")
    )

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())

    # NOTE: these two are chatty at INFO and say nothing this service's own logs do not.
    # Raised rather than silenced, so a genuine connection failure still surfaces.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
