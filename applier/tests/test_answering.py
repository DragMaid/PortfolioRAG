"""The code half of answering: what survives from the model's proposals.

The model is stubbed out entirely — the point of ``resolve`` is that it does not matter what
the model said, only whether it points at a real fact and a real option.
"""

from __future__ import annotations

import pytest

from applier.answering import Answerer, ProposedAnswer, ProposedAnswers, resolve
from applier.errors import UnanswerableError
from applier.forms import FieldHandle, match_option

FACTS = {
    "Right to work in Singapore": "Yes — Singapore Citizen",
    "Expected monthly salary": "SGD 6,000",
    "Years of professional software experience": "3",
}


def handle(id: str, kind: str, label: str, *, options=(), required=True, **rest) -> FieldHandle:
    return FieldHandle(
        {"id": id, "kind": kind, "label": label, "options": list(options), "required": required}
        | rest
    )


def proposed(*answers: tuple[str, object, str | None]) -> ProposedAnswers:
    return ProposedAnswers(
        answers=[ProposedAnswer(id=i, answer=a, fact=f) for i, a, f in answers]  # type: ignore[arg-type]
    )


def test_an_answer_must_name_a_stated_fact():
    fields = [handle("q0", "text", "Expected salary?"), handle("q1", "text", "Visa status?")]
    result = resolve(
        fields,
        proposed(
            ("q0", "6000", "Expected monthly salary"),
            ("q1", "Employment Pass", "Probably an EP holder"),
        ),
        FACTS,
    )

    assert result.answers == {"q0": "6000"}
    assert result.unanswered == ["Visa status?"]
    assert "cites no stated fact" in result.rejected[0]


def test_fact_keys_match_ignoring_case_and_spacing():
    fields = [handle("q0", "text", "Salary?")]
    result = resolve(fields, proposed(("q0", "6000", "expected  MONTHLY salary")), FACTS)
    assert result.answers == {"q0": "6000"}


def test_option_answers_must_be_options():
    options = ["Less than 1 year", "1-2 years", "More than 2 years"]
    fields = [
        handle("q0", "radio", "Experience?", options=options),
        handle("q1", "select", "Experience again?", options=options),
    ]
    result = resolve(
        fields,
        proposed(
            ("q0", "more than 2 years", "Years of professional software experience"),
            ("q1", "About 3 years", "Years of professional software experience"),
        ),
        FACTS,
    )

    assert result.answers == {"q0": "More than 2 years"}
    assert result.unanswered == ["Experience again?"]
    assert "is not an option" in result.rejected[0]


def test_checkbox_answers_are_lists_of_options():
    fields = [handle("q0", "checkbox", "Which apply?", options=["Citizen", "PR", "Pass holder"])]

    ok = resolve(fields, proposed(("q0", ["citizen"], "Right to work in Singapore")), FACTS)
    assert ok.answers == {"q0": ["Citizen"]}

    bad = resolve(
        fields, proposed(("q0", ["Citizen", "Alien"], "Right to work in Singapore")), FACTS
    )
    assert bad.answers == {}


def test_optional_questions_may_go_unanswered():
    fields = [handle("q0", "textarea", "Anything else?", required=False)]
    result = resolve(fields, proposed(("q0", None, None)), FACTS)
    assert result.answers == {}
    assert result.unanswered == []


def test_a_required_field_already_filled_is_not_unanswered():
    fields = [handle("q0", "text", "Email", current="me@example.com")]
    result = resolve(fields, proposed(("q0", None, None)), FACTS)
    assert result.unanswered == []


def test_numbers_and_lengths_are_checked():
    fields = [
        handle("q0", "number", "Salary"),
        handle("q1", "text", "Short answer", max_length=5),
    ]
    result = resolve(
        fields,
        proposed(
            ("q0", "6,000", "Expected monthly salary"),
            ("q1", "Singapore Citizen", "Right to work in Singapore"),
        ),
        FACTS,
    )
    assert result.answers == {"q0": "6000"}
    assert result.unanswered == ["Short answer"]


def test_match_option_never_picks_a_nearest_neighbour():
    options = ["Yes", "No", "Not sure"]
    assert match_option("yes", options) == "Yes"
    assert match_option("Not", options) == "Not sure"
    assert match_option("N", options) is None  # "No" and "Not sure" both start with it
    assert match_option("Maybe", options) is None


class FakeLlm:
    def __init__(self, answers: ProposedAnswers):
        self.answers = answers
        self.inputs: dict | None = None

    def call(self, work, *args):
        return work(*args)

    def structured(self, _prompt, inputs, _schema):
        self.inputs = inputs
        return self.answers


def test_answerer_raises_with_the_questions_it_could_not_answer():
    llm = FakeLlm(proposed(("q0", "6000", "Expected monthly salary")))
    answerer = Answerer(llm, FACTS, log=lambda _: None)
    fields = [handle("q0", "text", "Salary?"), handle("q1", "text", "Notice period?")]

    with pytest.raises(UnanswerableError) as raised:
        answerer.answer(fields, role="Engineer")

    assert raised.value.questions == ["Notice period?"]
    assert "Expected monthly salary: SGD 6,000" in llm.inputs["facts"]


def test_answerer_does_not_ask_about_file_inputs():
    llm = FakeLlm(proposed())
    answerer = Answerer(llm, FACTS, log=lambda _: None)
    assert answerer.answer([handle("f0", "file", "Resume")], role="Engineer") == {}
    assert llm.inputs is None
