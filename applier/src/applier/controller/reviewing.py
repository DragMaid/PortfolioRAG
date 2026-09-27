"""The answerer, with a person in the loop.

:class:`~applier.answering.Answerer` already throws out anything the model could not point at
a stated fact, and skips the posting when a required question is left with nothing. That is
the guarantee, and none of it is relaxed here. What this adds is a pause: the questions, the
checked answers and the fact each one rests on are put in front of a person before a single
one reaches the form.

Whatever a person types into a pause is remembered (``remember``), so the next form that
asks the same question is answered with it and does not stop to ask again.

It is also where a missing fact gets fixed on the spot. Without it, an unanswered required
question means editing ``applier.yaml`` and running again with ``--retry-skipped``; here the
fact is typed in, the model is asked the same questions again, and the application carries on.

An edit a person types is theirs, not the model's, so it does not need a fact behind it — but
it is still checked against the form: an option answer must name an option that exists, and a
length limit is a length limit. A hand-written answer that the form would refuse is worse than
no answer at all, because it is refused at the far end of a filled-in application.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from ..answering import Answerer, MemoryAnswerer
from ..config import Intervention
from ..errors import ApplierError, UnanswerableError
from ..forms import FieldHandle, match_option
from ..models import Answer


class Declined(ApplierError):
    """A person looked at the answers and said not to send this one."""

    terminal = True


class ReviewRequest:
    """One pause, with everything the page needs to draw it and settle it."""

    def __init__(self, questions: list[dict[str, Any]]):
        self.questions = questions
        self.decision: dict[str, Any] | None = None


def describe(
    handles: list[FieldHandle],
    answers: dict[str, Answer],
    unanswered: list[str],
    rejected: list[str],
) -> list[dict[str, Any]]:
    """Every question on the form, with what would be filled in and where it came from."""
    facts = _facts_by_question(rejected)
    described = []

    for handle in handles:
        field = handle.field
        label = field.label or field.id
        described.append(
            {
                "id": field.id,
                "question": label,
                "kind": field.kind,
                "required": field.required,
                "options": list(field.options),
                "maxLength": field.max_length,
                "answer": answers.get(field.id),
                "unanswered": label in unanswered,
                "discarded": facts.get(label),
            }
        )

    return described


def _facts_by_question(rejected: list[str]) -> dict[str, str]:
    """The answerer's discard lines, keyed by the question they were about."""
    by_question: dict[str, str] = {}
    for line in rejected:
        question, _, why = line.partition(": ")
        if why:
            by_question[question] = why
    return by_question


def check_edit(handle: FieldHandle, value: Answer) -> Answer:
    """A hand-typed answer, held to the same shape the form asks for."""
    field = handle.field

    if field.kind in ("radio", "select"):
        option = match_option(str(value), field.options)
        if option is None:
            raise ValueError(f"{field.label or field.id}: {value!r} is not one of the options")
        return option

    if field.kind == "checkbox":
        wanted = [value] if isinstance(value, str) else list(value)
        if handle.single_checkbox:
            return wanted[0] if wanted else ""
        matched = [match_option(str(item), field.options) for item in wanted]
        if None in matched:
            raise ValueError(f"{field.label or field.id}: not all of {wanted!r} are options")
        return [item for item in matched if item is not None]

    text = str(value)
    if field.max_length and len(text) > field.max_length:
        raise ValueError(
            f"{field.label or field.id}: {len(text)} characters, over the form's "
            f"{field.max_length}"
        )
    return text


class ReviewingAnswerer:
    """Wraps the real answerer and, when the toggle asks, waits for a person between
    the model's proposal and the form being filled.

    Lives on a board's worker thread and blocks it while it waits, which is the point: the
    form is half-filled and must not be walked further until the answers are settled.
    """

    def __init__(
        self,
        inner: Answerer | MemoryAnswerer,
        *,
        level: Intervention,
        ask: Callable[[list[dict[str, Any]]], dict[str, Any]],
        add_facts: Callable[[dict[str, str]], None],
        remember: Callable[[FieldHandle, Answer], None] | None = None,
        log: Callable[[str], None] = print,
    ):
        self.inner = inner
        self.level = level
        self.ask = ask
        self.add_facts = add_facts
        self.remember = remember
        self.log = log

    def answer(self, handles: list[FieldHandle], *, role: str) -> dict[str, Answer]:
        questions = [handle for handle in handles if handle.field.kind != "file"]
        if not questions:
            return {}

        by_id = {handle.field.id: handle for handle in questions}

        while True:
            answers, unanswered = self._propose(questions, role)

            if self.level == "never":
                if unanswered:
                    raise UnanswerableError(unanswered)
                return answers

            # Missing shows information that have yet been clarified by user
            if self.level == "missing" and not unanswered:
                return answers

            rejected = self.inner.last.rejected if self.inner.last else []
            decision = self.ask(describe(questions, answers, unanswered, rejected))
            action = decision.get("action")

            if action == "discard":
                raise Declined("You chose not to send this application.")

            if action == "retry":
                facts = {
                    str(key): str(value)
                    for key, value in (decision.get("facts") or {}).items()
                    if str(value).strip()
                }
                if facts:
                    self.add_facts(facts)
                    self.log(f"  added {len(facts)} fact(s); asking again")
                continue

            edited = dict(answers)
            for field_id, value in (decision.get("answers") or {}).items():
                handle = by_id.get(field_id)

                # If no handler is provided
                if handle is None:
                    continue

                # If no answer was provided
                if value in (None, "", []):
                    edited.pop(field_id, None)
                    continue

                edited[field_id] = check_edit(handle, value)

                # Answer if can from memory
                if self.remember is not None and edited[field_id] != answers.get(field_id):
                    self.remember(handle, edited[field_id])

            still_missing = [
                handle.field.label or handle.field.id
                for handle in questions
                if handle.field.required
                and not handle.field.current
                and handle.field.id not in edited
            ]
            if still_missing:
                raise UnanswerableError(still_missing)

            return edited

    def _propose(
        self, questions: list[FieldHandle], role: str
    ) -> tuple[dict[str, Answer], list[str]]:
        """The model's answers as code left them, and the required ones nothing answered."""
        try:
            return self.inner.answer(questions, role=role), []
        except UnanswerableError as error:
            kept = self.inner.last.answers if self.inner.last else {}
            return dict(kept), list(error.questions)
