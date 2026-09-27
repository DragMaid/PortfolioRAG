"""The answer bank: asked once, never again — but only where the old answer still fits."""

from __future__ import annotations

import pytest

from applier.answering import Answerer, MemoryAnswerer, ProposedAnswer, ProposedAnswers
from applier.errors import UnanswerableError
from applier.forms import FieldHandle
from applier.memory import AnswerMemory, question_key
from applier.models import FormField


@pytest.fixture
def memory(tmp_path):
    made = AnswerMemory(tmp_path / "ledger.sqlite")
    yield made
    made.close()


def field(label: str, kind="text", options=(), required=False, max_length=None, id="f0"):
    return FormField(
        id=id,
        kind=kind,
        label=label,
        required=required,
        options=list(options),
        max_length=max_length,
    )


def handle(found: FormField) -> FieldHandle:
    return FieldHandle(
        {
            "id": found.id,
            "kind": found.kind,
            "label": found.label,
            "required": found.required,
            "options": found.options,
            "max_length": found.max_length,
        }
    )


def test_the_same_question_is_recognised_through_decoration():
    assert question_key("Notice period *") == question_key("notice   period")
    assert question_key("Notice period (required)") == "notice period"
    assert question_key("Notice period:") == "notice period"


def test_a_remembered_answer_comes_back(memory):
    memory.remember(field("Notice period"), "1 month")

    assert memory.lookup(field("Notice period *")) == "1 month"
    assert memory.get("notice period").uses == 1


def test_an_option_answer_is_matched_to_this_forms_options(memory):
    memory.remember(field("Right to work?", "radio", ["Yes", "No"]), "Yes")

    assert memory.lookup(field("Right to work?", "select", ["yes", "no"])) == "yes"


def test_an_option_that_no_longer_exists_is_a_miss(memory):
    """A stale answer filled into the wrong control is worse than being asked again."""
    memory.remember(field("Years of experience", "radio", ["1-2", "3-5"]), "3-5")

    assert memory.lookup(field("Years of experience", "radio", ["0-3", "4+"])) is None


def test_a_number_and_a_length_limit_still_hold(memory):
    memory.remember(field("Expected salary"), "SGD 7,000")
    memory.remember(field("Why us"), "Because " * 20)

    assert memory.lookup(field("Expected salary", "number")) is None
    assert memory.lookup(field("Why us", max_length=20)) is None


def test_checkbox_answers_keep_every_option(memory):
    languages = field("Languages", "checkbox", ["English", "Mandarin"])
    memory.remember(languages, ["English", "Mandarin"])

    got = memory.lookup(field("Languages", "checkbox", ["English", "Mandarin", "Malay"]))
    assert got == ["English", "Mandarin"]


def test_forgetting(memory):
    memory.remember(field("Notice period"), "1 month")
    assert memory.forget("Notice period")
    assert memory.lookup(field("Notice period")) is None


# --- the answerer in front of the model -------------------------------------


class FakeLlm:
    """Answers every question it is asked from the fact named ``answer_with``."""

    def __init__(self, answers: dict[str, tuple[str, str]] | None = None):
        self.answers = answers or {}
        self.asked: list[list[str]] = []
        self.facts_seen: list[dict[str, str]] = []

    def call(self, work, *args):
        return work(*args)

    def structured(self, _prompt, inputs, _schema):
        questions = [line for line in inputs["questions"].splitlines() if line]
        import json

        parsed = [json.loads(line) for line in questions]
        self.asked.append([one["question"] for one in parsed])
        self.facts_seen.append(inputs["facts"])
        return ProposedAnswers(
            answers=[
                ProposedAnswer(
                    id=one["id"],
                    answer=self.answers.get(one["question"], (None, None))[0],
                    fact=self.answers.get(one["question"], (None, None))[1],
                )
                for one in parsed
            ]
        )


def test_the_model_is_only_asked_what_memory_cannot_answer(memory):
    memory.remember(field("Notice period"), "1 month")
    llm = FakeLlm({"Right to work?": ("Yes", "Citizen")})
    answerer = MemoryAnswerer(
        Answerer(llm, {"Full name": "Ada Lovelace", "Citizen": "Yes, Singaporean"}),
        memory,
        log=lambda _: None,
    )

    got = answerer.answer(
        [
            handle(field("Notice period", id="a")),
            handle(field("Right to work?", "radio", ["Yes", "No"], id="b")),
            handle(field("First name", id="c")),
        ],
        role="Engineer",
    )

    assert got == {"a": "1 month", "b": "Yes", "c": "Ada"}
    assert llm.asked == [["Right to work?"]], "the details and the memory needed no model"


def test_remembered_answers_are_facts_the_model_may_cite(memory):
    memory.remember(field("Notice period"), "1 month")
    llm = FakeLlm({"When can you start?": ("In a month", "Answered before — Notice period")})
    answerer = MemoryAnswerer(Answerer(llm, {}), memory, log=lambda _: None)

    got = answerer.answer([handle(field("When can you start?", id="a"))], role="Engineer")

    assert got == {"a": "In a month"}
    assert "Answered before — Notice period: 1 month" in llm.facts_seen[0]


def test_a_required_gap_still_raises_with_the_memory_answers_kept(memory):
    memory.remember(field("Notice period"), "1 month")
    answerer = MemoryAnswerer(Answerer(FakeLlm(), {}), memory, log=lambda _: None)

    with pytest.raises(UnanswerableError) as raised:
        answerer.answer(
            [
                handle(field("Notice period", id="a")),
                handle(field("Expected salary", required=True, id="b")),
            ],
            role="Engineer",
        )

    assert raised.value.questions == ["Expected salary"]
    assert answerer.last.answers == {"a": "1 month"}


def test_suggest_never_raises_and_says_where_each_answer_came_from(memory):
    memory.remember(field("Notice period"), "1 month")
    llm = FakeLlm({"Right to work?": ("Yes", "Citizen")})
    answerer = MemoryAnswerer(
        Answerer(llm, {"Email": "ada@example.com", "Citizen": "Yes"}), memory, log=lambda _: None
    )

    answers, sources = answerer.suggest(
        [
            handle(field("Email address", id="a")),
            handle(field("Notice period", id="b")),
            handle(field("Right to work?", "radio", ["Yes", "No"], id="c")),
            handle(field("Expected salary", required=True, id="d")),
        ],
        role="Engineer",
    )

    assert answers == {"a": "ada@example.com", "b": "1 month", "c": "Yes"}
    assert sources == {"a": "fact", "b": "memory", "c": "llm"}


def test_suggest_without_the_model_asks_it_nothing(memory):
    llm = FakeLlm()
    answerer = MemoryAnswerer(Answerer(llm, {}), memory, log=lambda _: None)

    answers, _ = answerer.suggest([handle(field("Anything", id="a"))], role="", use_model=False)

    assert answers == {}
    assert llm.asked == []
