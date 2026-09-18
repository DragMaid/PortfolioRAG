"""Writing an eval run to disk, with enough about the experiment to reproduce or compare it.

A number from an eval is only useful next to what produced it: which commit, which model,
which dataset, which retrieval settings. So every run gets its own directory:

    eval/reports/<run id>/
        run.json          what was run, on what, and the aggregate result
        summary.txt       the table the terminal printed
        cases/<id>.json   one per case: the input, the retrieval, the report, the grading

``run.json`` is written once setup has finished, with ``status: "running"``, rewritten after
every case, and finalised when the run ends — as ``completed``, ``interrupted`` or ``error``.
An interrupted run still leaves behind what it was and the cases it finished.
"""

from __future__ import annotations

import dataclasses
import hashlib
import json
import platform
import re
import socket
import subprocess
import sys
from datetime import UTC, datetime
from decimal import Decimal
from importlib import metadata
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from pydantic import BaseModel

from rag.queue import Usage
from rag.settings import Settings

REPORTS_DIR = Path(__file__).parent / "reports"

# Packages whose version changes what a run measures.
_PACKAGES = (
    "rag",
    "langchain-core",
    "langchain-anthropic",
    "langchain-openai",
    "langchain-google-genai",
    "langchain-groq",
    "fastembed",
    "camoufox",
    "playwright",
)

# Settings that can never reach a file, however local.
_SECRET_SETTINGS = {"encryption_key"}


def utc_now() -> datetime:
    return datetime.now(UTC)


def make_run_id(started: datetime, mode: str, provider: str | None, model: str | None) -> str:
    """Sortable by time, readable at a glance: ``20260915T101500Z_full_groq_gpt-oss-120b``."""
    parts = [started.strftime("%Y%m%dT%H%M%SZ"), mode]

    if provider:
        parts.append(provider)
    if model:
        parts.append(model)

    return re.sub(r"[^A-Za-z0-9._-]+", "-", "_".join(parts))


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git_state() -> dict[str, Any]:
    """Commit, branch and whether the tree had uncommitted changes. Empty outside a repo."""

    def git(*args: str) -> str | None:
        try:
            completed = subprocess.run(
                ["git", *args],
                cwd=Path(__file__).parent,
                capture_output=True,
                text=True,
                timeout=5,
                check=True,
            )
        except (OSError, subprocess.SubprocessError):
            return None
        return completed.stdout.strip()

    commit = git("rev-parse", "HEAD")

    if commit is None:
        return {}

    status = git("status", "--porcelain")

    return {
        "commit": commit,
        "branch": git("rev-parse", "--abbrev-ref", "HEAD"),
        # A dirty tree means the commit alone does not reproduce this run.
        "dirty": bool(status),
    }


def environment() -> dict[str, Any]:
    versions: dict[str, str | None] = {}

    for package in _PACKAGES:
        try:
            versions[package] = metadata.version(package)
        except metadata.PackageNotFoundError:
            versions[package] = None

    return {
        "host": socket.gethostname(),
        "platform": platform.platform(),
        "python": sys.version.split()[0],
        "packages": versions,
    }


def settings_snapshot(settings: Settings) -> dict[str, Any]:
    """Every setting that shapes the result, with secrets dropped and the DB password masked."""
    snapshot = settings.model_dump(mode="json", exclude=_SECRET_SETTINGS)
    snapshot["database_url"] = _mask_password(settings.database_url)
    return snapshot


def _mask_password(url: str) -> str:
    parts = urlsplit(url)

    if parts.password is None:
        return url

    netloc = parts.netloc.replace(f":{parts.password}@", ":***@", 1)
    return urlunsplit(parts._replace(netloc=netloc))


def usage_between(before: Usage, after: Usage) -> dict[str, Any]:
    """What one case spent, from the pipeline's running total either side of it."""
    return usage_dict(
        Usage(
            input_tokens=after.input_tokens - before.input_tokens,
            output_tokens=after.output_tokens - before.output_tokens,
            cost_usd=after.cost_usd - before.cost_usd,
        )
    )


def usage_dict(usage: Usage) -> dict[str, Any]:
    return {
        "input_tokens": usage.input_tokens,
        "output_tokens": usage.output_tokens,
        "cost_usd": str(usage.cost_usd),
    }


class RunWriter:
    """Owns one run's directory. Every write replaces the whole file, so a reader never
    sees half a JSON document."""

    def __init__(self, root: Path, run_id: str):
        self.directory = root / run_id
        self.cases_directory = self.directory / "cases"
        self.cases_directory.mkdir(parents=True, exist_ok=False)

    def write_run(self, run: dict[str, Any]) -> None:
        self._write_json(self.directory / "run.json", run)

    def write_case(self, case_id: str, case: dict[str, Any]) -> Path:
        path = self.cases_directory / f"{re.sub(r'[^A-Za-z0-9._-]+', '-', case_id)}.json"
        self._write_json(path, case)
        return path

    def write_summary(self, text: str) -> None:
        self._atomic_write(self.directory / "summary.txt", text)

    def _write_json(self, path: Path, value: dict[str, Any]) -> None:
        self._atomic_write(path, json.dumps(value, indent=2, default=_json_default) + "\n")

    @staticmethod
    def _atomic_write(path: Path, text: str) -> None:
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(text, encoding="utf-8")
        temporary.replace(path)


def _json_default(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return dataclasses.asdict(value)
    return str(value)
