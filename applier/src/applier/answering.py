"""Answering employer questions from the candidate's facts, and only from them.

The same split as the rag pipeline: the model proposes, code disposes. The model is shown
the questions and the facts and asked for an answer per question, the fact it rests on, or
nothing. Then, in code:

* an option answer must name one of the options, or it is no answer;
* an answer that cites no fact, or a fact that is not in the list, is no answer;
* a required question left with no answer makes the posting unanswerable.

What the model can never do is invent a salary, a visa status or a year of experience,
because the only way an answer reaches the form is by pointing at a line the candidate wrote.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Protocol

from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

from .forms import FieldHandle, match_option, normalise
from .models import Answer

ANSWER_SYSTEM = """\
You fill in a job application's employer questions for a candidate, using only the facts \
they wrote down.

Rules:
- Answer a question only when a fact states or directly implies the answer. Name that fact \
by its exact key in "fact".
- Nothing to go on means answer null. Do not guess, and do not choose a "closest" option \
because it is closest. A skipped application is fine; a false answer to an employer is not.
- For a question with options, answer with the option text exactly as written. For a \
checkbox question, answer with a list of every option that applies.
- Arithmetic from a fact is fine: "3 years" answers "More than 2 years".
- "Current value" is what the form already holds. Keep it (answer with it) when a fact \
supports it, and correct it when a fact contradicts it.
- Free-text questions get a short, plain answer in the candidate's voice, built only from \
facts — the cover letter is attached separately and does not need repeating.
- The candidate's notes steer wording and which option to take where two fit. They are not \
facts, and an answer cannot cite them.\
"""

ANSWER_USER = """\
Role: {role}

<notes>
{notes}
</notes>

<facts>
{facts}
</facts>

<questions>
{questions}
</questions>\
"""

ANSWER_PROMPT = ChatPromptTemplate.from_messages([("system", ANSWER_SYSTEM), ("user", ANSWER_USER)])


class ProposedAnswer(BaseModel):
    id: str = Field(description="The question's id, exactly as given.")
    answer: str | list[str] | None = Field(
        description="The answer, an option's exact text, a list of options, or null."
    )
    fact: str | None = Field(
        default=None, description="The key of the fact the answer rests on, exactly as given."
    )


class ProposedAnswers(BaseModel):
    answers: list[ProposedAnswer]


@dataclass(slots=True)
class Resolution:
    answers: dict[str, Answer] = field(default_factory=dict)
    # Required questions no fact answered, by their label.
    unanswered: list[str] = field(default_factory=list)
    # Answers the model gave that code threw out, with why. Logged, never filled.
    rejected: list[str] = field(default_factory=list)


def render_facts(facts: dict[str, str]) -> str:
    return "\n".join(f"- {key}: {value}" for key, value in facts.items())


def render_questions(handles: list[FieldHandle]) -> str:
    import json

    return "\n".join(json.dumps(handle.field.describe(), ensure_ascii=False) for handle in handles)


def resolve(
    handles: list[FieldHandle],
    proposed: ProposedAnswers,
    facts: dict[str, str],
) -> Resolution:
    """Keeps only answers that name a real fact and, where there are options, a real option."""
    by_id = {answer.id: answer for answer in proposed.answers}
    known = {normalise(key): key for key in facts}
    resolution = Resolution()

    for handle in handles:
        question = handle.field
        proposal = by_id.get(question.id)
        value = _checked(question, proposal, known, resolution)

        if value is not None:
            resolution.answers[question.id] = value
        elif question.required and not question.current:
            resolution.unanswered.append(question.label or question.id)

    return resolution


def _checked(question, proposal, known, resolution) -> Answer | None:
    if proposal is None or proposal.answer in (None, "", []):
        return None

    label = question.label or question.id

    if not proposal.fact or normalise(proposal.fact) not in known:
        resolution.rejected.append(f"{label}: cites no stated fact ({proposal.fact!r})")
        return None

    answer = proposal.answer

    if question.kind == "checkbox":
        values = [answer] if isinstance(answer, str) else list(answer)
        matched = [match_option(value, question.options) for value in values]
        if None in matched:
            resolution.rejected.append(f"{label}: {values!r} are not all options")
            return None
        return [value for value in matched if value is not None]

    if isinstance(answer, list):
        if len(answer) != 1:
            resolution.rejected.append(f"{label}: several answers to a single question")
            return None
        answer = answer[0]

    if question.kind in ("radio", "select"):
        option = match_option(answer, question.options)
        if option is None:
            resolution.rejected.append(f"{label}: {answer!r} is not an option")
        return option

    if question.kind == "number":
        digits = answer.replace(",", "").strip()
        try:
            float(digits)
        except ValueError:
            resolution.rejected.append(f"{label}: {answer!r} is not a number")
            return None
        return digits

    if question.max_length and len(answer) > question.max_length:
        resolution.rejected.append(f"{label}: longer than {question.max_length} characters")
        return None

    return answer


class AnswerProvider(Protocol):
    """What a board is handed to answer the questions on its form.

    :class:`Answerer` is the one the CLI uses. The controller wraps it in one that can stop
    and ask a person first, so boards are typed against this and never against either.
    """

    def answer(self, handles: list[FieldHandle], *, role: str) -> dict[str, Answer]: ...


class Answerer:
    """The unattended answerer: the model proposes, :func:`resolve` disposes.

    Boards call :meth:`answer` with whatever fields they found; the answerer returns only
    answers that survived :func:`resolve`, or raises when a required one did not.
    """

    def __init__(self, llm, facts: dict[str, str], *, notes: str | None = None, log=print):
        self.llm = llm
        self.facts = facts
        self.notes = notes
        self.log = log
        self.last: Resolution | None = None

    def answer(
        self, handles: list[FieldHandle], *, role: str, facts: dict[str, str] | None = None
    ) -> dict[str, Answer]:
        """``facts`` replaces the candidate's for this call — the memory adds its own."""
        from .errors import UnanswerableError

        facts = self.facts if facts is None else facts
        # Files are the board's business (a resume is not an employer question).
        questions = [handle for handle in handles if handle.field.kind != "file"]
        if not questions:
            self.last = Resolution()
            return {}

        proposed = self.llm.call(
            self.llm.structured,
            ANSWER_PROMPT,
            {
                "role": role,
                "notes": self.notes or "(none)",
                "facts": render_facts(facts),
                "questions": render_questions(questions),
            },
            ProposedAnswers,
        )
        resolution = self.last = resolve(questions, proposed, facts)

        for reason in resolution.rejected:
            self.log(f"  discarded an answer — {reason}")

        if resolution.unanswered:
            raise UnanswerableError(resolution.unanswered)

        return resolution.answers


# Standard identity questions, answered straight from the candidate's details. Every form
# asks them, in a dozen wordings, and none of them needs a model.
_IDENTITY: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"^(your )?(full |legal )?name$"), "full"),
    (re.compile(r"^(first|given|preferred first) name$"), "first"),
    (re.compile(r"^(last|family) name$|^surname$"), "last"),
    (re.compile(r"^(your )?e-?mail( address)?$"), "email"),
    (re.compile(r"^(your )?(mobile|phone|telephone|contact)( phone)?( number| no\.?)?$"), "phone"),
]


class MemoryAnswerer:
    """The answerer, asking the answer bank first and the model only about the rest.

    Three sources, cheapest first: the candidate's own details for the questions every form
    asks, then answers a person gave before, then the model — which is shown the remembered
    answers as facts it may cite, so a question worded differently from last time is still
    answered from what was said last time. The model's answers go through :func:`resolve` as
    always; nothing here lets it invent.
    """

    def __init__(self, inner: Answerer, memory, *, log=print):
        self.inner = inner
        self.memory = memory
        self.log = log
        self.last: Resolution | None = None

    @property
    def facts(self) -> dict[str, str]:
        return self.inner.facts

    def recall(self, handles: list[FieldHandle]) -> tuple[dict[str, Answer], dict[str, str]]:
        """Answers that need no model: the candidate's details, then the answer bank."""
        from .memory import fit, question_key

        answers: dict[str, Answer] = {}
        sources: dict[str, str] = {}
        details = _details(self.inner.facts)

        for handle in handles:
            field = handle.field
            if field.kind == "file":
                continue
            key = question_key(field.label)

            # Extracting and filling for self-identification questions
            for pattern, which in _IDENTITY:
                if pattern.match(key) and details.get(which):
                    value = fit(field, details[which])
                    if value is not None:
                        answers[field.id] = value
                        sources[field.id] = "fact"
                    break

            if field.id in answers:
                continue

            if (remembered := self.memory.lookup(field)) is not None:
                answers[field.id] = remembered
                sources[field.id] = "memory"

        return answers, sources

    def answer(self, handles: list[FieldHandle], *, role: str) -> dict[str, Answer]:
        from .errors import UnanswerableError

        questions = [handle for handle in handles if handle.field.kind != "file"]
        known, _ = self.recall(questions)
        rest = [handle for handle in questions if handle.field.id not in known]

        resolution = Resolution(answers=dict(known))
        self.last = resolution
        if known:
            self.log(f"  {len(known)} answer(s) from what you said before")
        if not rest:
            return resolution.answers

        try:
            # concat current answers with answers generated by LLM given facts
            resolution.answers |= self.inner.answer(rest, role=role, facts=self._facts())
        except UnanswerableError as error:
            inner = self.inner.last or Resolution()
            resolution.answers |= inner.answers
            resolution.unanswered = list(error.questions)
            resolution.rejected = inner.rejected
            raise UnanswerableError(resolution.unanswered) from None

        if self.inner.last is not None:
            resolution.rejected = self.inner.last.rejected

        return resolution.answers

    def suggest(
        self, handles: list[FieldHandle], *, role: str, use_model: bool = True
    ) -> tuple[dict[str, Answer], dict[str, str]]:
        """Every answer there is, and where each came from. Never raises for a gap.

        What the extension fills a page from: a form on some employer's site is filled as far
        as it can be, and whatever is left over is asked in the side panel rather than
        stopping anything.
        """
        from .errors import UnanswerableError

        questions = [handle for handle in handles if handle.field.kind != "file"]
        answers, sources = self.recall(questions)
        rest = [handle for handle in questions if handle.field.id not in answers]

        if rest and use_model:
            try:
                found = self.inner.answer(rest, role=role, facts=self._facts())
            except UnanswerableError:
                found = self.inner.last.answers if self.inner.last else {}

            for field_id, value in found.items():
                answers[field_id], sources[field_id] = value, "llm"

        return answers, sources

    def _facts(self) -> dict[str, str]:
        return self.memory.as_facts() | self.inner.facts


def _details(facts: dict[str, str]) -> dict[str, str]:
    full = facts.get("Full name", "").strip()
    parts = full.split()
    return {
        "full": full,
        "first": parts[0] if parts else "",
        "last": parts[-1] if len(parts) > 1 else "",
        "email": facts.get("Email", "").strip(),
        "phone": facts.get("Phone", "").strip(),
    }
