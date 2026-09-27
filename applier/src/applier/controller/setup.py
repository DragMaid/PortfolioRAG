"""The setup run: one mock application, and the questions it found.

Nobody can write down, in advance, the facts an employer will ask them for. So this does not
ask them to. It walks one real posting's form as far as its questions, stops there, and hands
back what that employer actually wanted to know — merged with the handful of things nearly
every board asks — as a list to fill in. The answers become ``candidate.facts``, and from
then on the answerer has something to point at.

Nothing here sends anything. The mock walk stops on the questions step and the tab is closed;
the posting is not recorded, so it stays available to apply to properly later.

What it cannot do is finish the job. One posting's form asks three or four things, and the
baseline covers the common ground, but employers keep asking new questions — which is what
the ``missing`` intervention level is for: the run stops, asks, and the fact you type is kept.
Setup gets you to a working profile; the runs themselves keep it working.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

from pydantic import BaseModel, Field

from ..models import FieldKind, FormField, Probe

# Where an answer goes. Three of them are the candidate's own details rather than facts, and
# the config has proper homes for those.
Target = Literal["name", "email", "phone", "fact"]


@dataclass(slots=True)
class SetupQuestion:
    """One thing to answer during setup, from a real form or from the baseline."""

    id: str
    question: str
    kind: FieldKind = "text"
    options: list[str] = field(default_factory=list)
    required: bool = False
    # What the fact will be called once it is written down. Editable on the page: it is the
    # key an answer has to cite later, so it should read like a statement, not a question.
    fact_key: str = ""
    target: Target = "fact"
    hint: str | None = None
    # "posting" — this employer asked it. "baseline" — most of them do.
    source: Literal["posting", "baseline"] = "baseline"

    def as_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["factKey"] = data.pop("fact_key")
        return data


BASELINE: list[SetupQuestion] = [
    SetupQuestion(
        id="name",
        question="What is your full name?",
        target="name",
        required=True,
        fact_key="Full name",
        hint="As it should appear on an application.",
    ),
    SetupQuestion(id="email", question="Your email address", target="email", fact_key="Email"),
    SetupQuestion(id="phone", question="Your phone number", target="phone", fact_key="Phone"),
    SetupQuestion(
        id="work_rights",
        question="What is your right to work where you are applying?",
        fact_key="Right to work",
        hint='Boards ask this constantly, and phrase it a dozen ways. Something like "Yes — '
        'Singapore citizen" answers most of them.',
    ),
    SetupQuestion(
        id="sponsorship",
        question="Do you require visa sponsorship?",
        kind="radio",
        options=["Yes", "No"],
        fact_key="Requires visa sponsorship",
    ),
    SetupQuestion(
        id="salary",
        question="What salary do you expect?",
        fact_key="Expected salary",
        hint="Include the currency and the period, as you would write it on a form.",
    ),
    SetupQuestion(
        id="notice",
        question="What is your notice period, or when could you start?",
        fact_key="Notice period",
    ),
    SetupQuestion(
        id="experience",
        question="How many years of professional experience do you have?",
        kind="number",
        fact_key="Years of professional experience",
    ),
    SetupQuestion(
        id="education",
        question="What is your highest level of education?",
        fact_key="Highest education",
    ),
    SetupQuestion(
        id="arrangement",
        question="Are you willing to work on site?",
        fact_key="Willing to work on site",
        hint='A sentence is fine: "Yes, hybrid preferred".',
    ),
    SetupQuestion(
        id="relocate",
        question="Are you willing to relocate?",
        kind="radio",
        options=["Yes", "No"],
        fact_key="Willing to relocate",
    ),
    SetupQuestion(
        id="languages",
        question="Which languages do you speak?",
        fact_key="Languages spoken",
    ),
]

# Leading words that turn a statement into a question. Stripping them is what turns "Do you
# have a valid driving licence?" into a fact called "Valid driving licence", which is what an
# answer has to cite — and reads like something a person wrote down rather than was asked.
_OPENERS = re.compile(
    r"^(?:"
    r"which of the following statements best describes (?:your|the)|"
    r"please (?:indicate|state|tell us|confirm|specify)(?: your| the| if| whether)?|"
    r"can you (?:please )?(?:tell us|confirm|state)(?: your| the)?|"
    r"what(?:'s| is| are)?(?: your| the)?|"
    r"how many|how much|how soon|how would you rate your|"
    r"do you (?:have|hold|possess|require|need)(?: an?| any| the)?|"
    r"are you(?: currently| legally)?|"
    r"have you (?:ever|previously)?|"
    r"will you|would you|is your|tell us about(?: your)?"
    r")\s+",
    re.IGNORECASE,
)

# The same words again, in the middle of a sentence: "How many years do you have as a …".
# Stripping the opener alone leaves those stranded.
_MIDDLE = re.compile(
    r"\s+\b(?:do you (?:have|hold|possess)|have you got|would you say you have)\b", re.IGNORECASE
)

_SPACE = re.compile(r"\s+")


def fact_key(question: str) -> str:
    """A fact's name, derived from the question that asked for it.

    Code, not a model: setup has to work before any provider is configured, and a name the
    page shows you and lets you change is worth more than a cleverer one it does not.
    """
    text = _SPACE.sub(" ", question).strip().rstrip("?:. ").strip()
    text = text.removeprefix("*").strip()

    while True:
        shortened = _OPENERS.sub("", text, count=1)
        if shortened == text:
            break
        text = shortened.strip()

    text = _MIDDLE.sub("", text)
    text = re.sub(r"\s*\(.*?\)\s*$", "", text).strip()
    # A question that is nothing but punctuation, or entirely made of opening words, has
    # nothing left to name it after. Its own text is a worse name than a derived one and a
    # far better one than the empty string.
    text = text or _SPACE.sub(" ", question).strip() or "Answer"
    return text[:1].upper() + text[1:]


def _identity(question: str) -> str:
    return _SPACE.sub(" ", question).strip().rstrip("?:. ").casefold()


def from_probe(probe: Probe) -> list[SetupQuestion]:
    """The mock application's findings, as questions to answer."""
    return [_from_field(field_) for field_ in probe.questions if field_.kind != "file"]


def _from_field(found: FormField) -> SetupQuestion:
    label = found.label or found.id
    return SetupQuestion(
        id=f"probe:{found.id}",
        question=label,
        kind=found.kind,
        options=list(found.options),
        required=found.required,
        fact_key=fact_key(label),
        source="posting",
    )


def merge(probed: list[SetupQuestion], baseline: list[SetupQuestion]) -> list[SetupQuestion]:
    """The form's questions first, then the baseline's, with duplicates dropped.

    The employer's own wording wins where both ask the same thing: it is the one that will
    appear on a form again, and matching it makes the fact obviously the right answer.
    """
    seen = {_identity(question.question) for question in probed}
    seen |= {question.fact_key.casefold() for question in probed}

    extra = [
        question
        for question in baseline
        if _identity(question.question) not in seen and question.fact_key.casefold() not in seen
    ]
    return [*probed, *extra]


def to_profile(
    questions: list[SetupQuestion], answers: dict[str, str]
) -> tuple[dict[str, str | None], dict[str, str]]:
    """Answers split into the candidate's own details and the facts. Blanks are left out.

    A question nobody answered is simply not written down, which is the honest outcome: the
    run will ask about it when an employer does, and the fact will be right then rather than
    guessed at now.
    """
    details: dict[str, str | None] = {}
    facts: dict[str, str] = {}

    for question in questions:
        value = (answers.get(question.id) or "").strip()
        if not value:
            continue
        if question.target == "fact":
            key = (question.fact_key or fact_key(question.question)).strip()
            if key:
                facts[key] = value
        else:
            details[question.target] = value

    return details, facts


class SuggestedSearch(BaseModel):
    """One search the portfolio's own contents argue for."""

    keywords: str = Field(
        description="What to type into a job board's search box. Two or three words, the "
        "name of a role as postings title it — 'backend engineer', not 'Python'."
    )
    why: str = Field(description="One short clause: the work in the portfolio that supports it.")
    evidence: Literal["strong", "partial", "thin"] = Field(
        description=(
            "'strong' when several passages show this work directly; 'partial' when it is "
            "adjacent; 'thin' when it is a stretch from what is published."
        )
    )


class SuggestedSearches(BaseModel):
    searches: list[SuggestedSearch] = Field(description="Up to six, best evidenced first.")


SUGGEST_SYSTEM = """\
You read somebody's portfolio and say which roles their published work would stand up to \
applying for.

Rules:
- Propose searches as a job board would title the role, not as a skill list.
- Rank by what the passages actually show, not by what a person with those skills could \
probably also do. A portfolio is not a complete history, and a search that turns up \
postings the work does not evidence wastes the reader's time and the applicant's.
- Say 'thin' rather than leaving out a plausible direction; the person chooses.\
"""

SUGGEST_USER = """\
<passages>
{passages}
</passages>

Which job searches would this work stand up to?\
"""
