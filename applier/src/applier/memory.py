"""Answers a person has given before, kept so they are never asked twice.

Facts (``candidate.facts``) are what the model may build an answer from. This is the other
half: the literal answer somebody typed for a question, the last time a form asked it —
in a review pause, in the extension's side panel, or in setup. The next form that asks the
same question gets the same answer without the model being asked anything.

The same question is recognised by its label, normalised (case, spacing, a trailing ``*`` or
``(required)``). A remembered answer is only reused where it still fits the form: an option
answer has to name one of *this* form's options, a number has to be a number, and a length
limit is a length limit. Anything that does not fit is a miss, and the question goes on to
the model or the person as if it had never been answered — a stale answer filled into the
wrong control is worse than being asked again.

One table in the ledger's SQLite file, beside ``postings``.
"""

from __future__ import annotations

import json
import re
import sqlite3
import threading
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from .forms import match_option, normalise
from .models import Answer, FormField

Source = Literal["user", "review", "setup", "extension"]

_SCHEMA = """
CREATE TABLE IF NOT EXISTS answers (
    key         TEXT PRIMARY KEY,
    label       TEXT NOT NULL,
    kind        TEXT NOT NULL,
    answer      TEXT NOT NULL,
    source      TEXT NOT NULL,
    uses        INTEGER NOT NULL DEFAULT 0,
    updated_at  TEXT NOT NULL
);
"""

# Decoration a form puts on a label that does not change the question.
_DECORATION = re.compile(r"(\s*\*+\s*$)|(\s*\((required|optional)\)\s*$)|(\s*[:?]\s*$)", re.I)


def question_key(label: str) -> str:
    """The label two forms asking the same question would agree on."""
    text = normalise(label)
    previous = None
    while previous != text:
        previous, text = text, _DECORATION.sub("", text).strip()
    return text


@dataclass(slots=True)
class Remembered:
    key: str
    label: str
    kind: str
    answer: Answer
    source: str
    uses: int
    updated_at: str

    def as_dict(self) -> dict:
        return {
            "key": self.key,
            "label": self.label,
            "kind": self.kind,
            "answer": self.answer,
            "source": self.source,
            "uses": self.uses,
            "updatedAt": self.updated_at,
        }


class AnswerMemory:
    """The answer bank. Safe to share between threads, like the ledger."""

    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self._lock = threading.RLock()
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._db.executescript(_SCHEMA)

    def close(self) -> None:
        with self._lock:
            self._db.close()

    def get(self, label: str) -> Remembered | None:
        key = question_key(label)
        if not key:
            return None
        with self._lock:
            row = self._db.execute("SELECT * FROM answers WHERE key = ?", (key,)).fetchone()
        return _remembered(row) if row else None

    def lookup(self, field: FormField) -> Answer | None:
        """The remembered answer to this question, shaped to this form, or None."""
        if field.kind == "file" or not field.label:
            return None

        found = self.get(field.label)
        if found is None:
            return None

        fitted = fit(field, found.answer)
        # Increment usage count
        if fitted is not None:
            with self._lock, self._db:
                self._db.execute("UPDATE answers SET uses = uses + 1 WHERE key = ?", (found.key,))

        return fitted

    def remember(self, field: FormField, answer: Answer, source: Source = "user") -> None:
        key = question_key(field.label)
        if not key or answer in (None, "", []):
            return
        now = datetime.now(UTC).isoformat(timespec="seconds")
        with self._lock, self._db:
            self._db.execute(
                """
                INSERT INTO answers (key, label, kind, answer, source, uses, updated_at)
                VALUES (?, ?, ?, ?, ?, 0, ?)
                ON CONFLICT (key) DO UPDATE SET
                    label = excluded.label,
                    kind = excluded.kind,
                    answer = excluded.answer,
                    source = excluded.source,
                    updated_at = excluded.updated_at
                """,
                (key, field.label, field.kind, json.dumps(answer), source, now),
            )

    def forget(self, key: str) -> bool:
        with self._lock, self._db:
            cursor = self._db.execute("DELETE FROM answers WHERE key = ?", (question_key(key),))
        return cursor.rowcount > 0

    def entries(self) -> list[Remembered]:
        with self._lock:
            rows = self._db.execute("SELECT * FROM answers ORDER BY updated_at DESC").fetchall()
        return [_remembered(row) for row in rows]

    def as_facts(self) -> dict[str, str]:
        """Every remembered answer as a fact the model may cite, for questions worded
        differently from the one that was answered ("Notice period" and "When can you start?").
        """
        return {
            f"Answered before — {entry.label}": _text(entry.answer) for entry in self.entries()
        }


def fit(field: FormField, answer: Answer) -> Answer | None:
    """A remembered answer as this form's control would take it, or None if it will not."""
    if field.kind == "checkbox":
        values = [answer] if isinstance(answer, str) else list(answer)
        matched = [match_option(str(value), field.options) for value in values]
        if not values or None in matched:
            return None
        return [value for value in matched if value is not None]

    if isinstance(answer, list):
        if len(answer) != 1:
            return None
        answer = answer[0]
    answer = str(answer)

    if field.kind in ("radio", "select"):
        return match_option(answer, field.options)

    # Additioal check for digit fields
    if field.kind == "number":
        digits = answer.replace(",", "").strip()
        try:
            float(digits)
        except ValueError:
            return None
        return digits

    if field.max_length and len(answer) > field.max_length:
        return None

    return answer


def _text(answer: Answer) -> str:
    return answer if isinstance(answer, str) else ", ".join(answer)


def _remembered(row: sqlite3.Row) -> Remembered:
    return Remembered(
        key=row["key"],
        label=row["label"],
        kind=row["kind"],
        answer=json.loads(row["answer"]),
        source=row["source"],
        uses=row["uses"],
        updated_at=row["updated_at"],
    )
