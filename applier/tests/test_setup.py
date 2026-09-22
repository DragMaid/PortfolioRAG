"""Setting up without writing a config first, and the config the page writes.

The point being tested is that a working profile can be arrived at by answering questions
rather than by imagining them: the mock application reads a real form, what it found becomes
facts, and the facts land in a file the command line reads too.

Also here: that the file survives being written. A config the page can quietly strip of its
comments, or leave invalid, is worse than one the page cannot write at all.
"""

from __future__ import annotations

import pytest

from applier.config import load, load_or_create, parse, save
from applier.controller.setup import BASELINE, SetupQuestion, fact_key, merge, to_profile
from applier.errors import ConfigError
from test_controller import make_session, state_at, wait_for

# `make_session` is a fixture defined in test_controller; importing it brings it in here.
_ = make_session


# --- naming a fact after the question that asked for it ---------------------


@pytest.mark.parametrize(
    ("question", "expected"),
    [
        (
            "Which of the following statements best describes your right to work in Singapore?",
            "Right to work in Singapore",
        ),
        ("What's your expected monthly basic salary?", "Expected monthly basic salary"),
        ("Do you have a valid driver's licence?", "Valid driver's licence"),
        ("Are you willing to relocate for this role?", "Willing to relocate for this role"),
        ("How many years' experience do you have as a Backend Engineer?",
         "Years' experience as a Backend Engineer"),
        ("Please indicate your notice period", "Notice period"),
        ("Expected monthly salary (SGD)", "Expected monthly salary"),
    ],
)
def test_a_fact_is_named_after_what_it_states(question: str, expected: str) -> None:
    """Facts read as statements, because that is what an answer has to cite.

    Derived in code rather than by a model: setup has to work before any provider is
    configured, and a name the page shows and lets you change beats a cleverer one it does not.
    """
    assert fact_key(question) == expected


def test_a_question_that_defeats_the_rules_still_gets_a_name() -> None:
    assert fact_key("???") == "???"
    assert fact_key("Kubernetes") == "Kubernetes"


# --- merging what the employer asked with what everyone asks ----------------


def question(label: str, **rest) -> SetupQuestion:
    return SetupQuestion(
        id=label, question=label, fact_key=fact_key(label), source="posting", **rest
    )


def test_the_employers_own_wording_wins_over_the_baseline() -> None:
    """Both ask about notice; the form's phrasing is the one that will appear again."""
    probed = [question("Please indicate your notice period")]

    merged = merge(probed, BASELINE)
    notice = [one for one in merged if one.fact_key == "Notice period"]

    assert len(notice) == 1, "the baseline's version should have been dropped"
    assert notice[0].source == "posting"
    assert notice[0].question == "Please indicate your notice period"


def test_what_the_employer_did_not_ask_is_still_offered() -> None:
    merged = merge([question("Expected monthly salary (SGD)")], BASELINE)
    keys = {one.fact_key for one in merged}

    assert "Expected monthly salary" in keys, "the form's own question"
    assert "Right to work" in keys, "and the common ones it did not ask"
    assert "Full name" in keys


# --- answers become a profile ----------------------------------------------


def test_answers_split_into_details_and_facts() -> None:
    questions = merge([question("Expected monthly salary (SGD)")], BASELINE)
    answers = {
        "name": "Tester",
        "email": "t@example.com",
        "Expected monthly salary (SGD)": "7000",
        "notice": "1 month",
    }

    details, facts = to_profile(questions, answers)

    assert details == {"name": "Tester", "email": "t@example.com"}
    assert facts == {"Expected monthly salary": "7000", "Notice period": "1 month"}


def test_a_question_left_blank_is_not_written_down() -> None:
    """The honest outcome. A run will ask when an employer does, and be right then."""
    _, facts = to_profile(BASELINE, {"notice": "  ", "salary": "", "relocate": "No"})

    assert facts == {"Willing to relocate": "No"}


# --- the mock application ---------------------------------------------------


def test_the_mock_run_reads_the_form_and_sends_nothing(make_session) -> None:
    session, board, browser = make_session(1)
    session.probe("https://fake/job/0")

    wait_for(lambda: session.setup_state()["found"] is not None, "it should find the questions")
    found = session.setup_state()["found"]

    assert found["questions"] == 2
    assert found["resumes"] == ["Resume_2026.pdf", "Resume_old.pdf"]
    assert board.applied == [], "a mock application applies to nothing"
    assert board.sent == set()
    assert browser.tabs == [], "and leaves no tab behind"
    assert session.ledger.get("fake:0") is None, "nor anything on the record"


def test_the_questions_it_found_come_back_named_as_facts(make_session) -> None:
    session, _, _ = make_session(1)
    session.probe("https://fake/job/0")
    wait_for(lambda: session.setup_state()["found"] is not None, "it should find the questions")

    questions = session.setup_state()["questions"]
    from_posting = [one for one in questions if one["source"] == "posting"]

    assert [one["factKey"] for one in from_posting] == [
        "Expected monthly salary",
        "Valid driving licence",
    ]
    assert any(one["source"] == "baseline" for one in questions), "the common ones too"


def test_answering_setup_writes_the_facts_to_the_config(make_session) -> None:
    session, _, _ = make_session(1)
    session.probe("https://fake/job/0")
    wait_for(lambda: session.setup_state()["found"] is not None, "it should find the questions")

    ids = {one["factKey"]: one["id"] for one in session.setup_state()["questions"]}
    session.save_setup(
        {
            "answers": {
                ids["Full name"]: "Tester McTest",
                ids["Expected monthly salary"]: "7000",
                ids["Valid driving licence"]: "No",
            },
            "resume": {"select": "Resume_2026.pdf"},
            "answerNotes": "Take the conservative option.",
        }
    )

    saved = load(session.config.source_path)
    assert saved.candidate.facts["Expected monthly salary"] == "7000"
    assert saved.candidate.facts["Valid driving licence"] == "No"
    assert saved.candidate.name == "Tester McTest"

    # And it is live, not just on disk: the answerer can cite it on the very next posting.
    assert session.answerer.facts["Expected monthly salary"] == "7000"
    assert session.config.setup_done is True
    assert session.config.candidate.resume.select == "Resume_2026.pdf"


def test_a_posting_that_cannot_be_applied_to_says_so(make_session) -> None:
    from applier.models import ApplyMethod

    session, board, _ = make_session(1)
    board.method = ApplyMethod.EXTERNAL
    session.probe("https://fake/job/0")

    wait_for(lambda: session.setup_state()["error"] is not None, "it should report the problem")
    assert "another one" in session.setup_state()["error"]


def test_setup_can_be_skipped(make_session) -> None:
    session, _, _ = make_session(0)
    assert session.config.setup_done is False

    session.skip_setup()

    assert session.config.setup_done is True
    assert load(session.config.source_path).setup_done is True


def test_suggesting_searches_says_so_when_the_portfolio_is_unreachable(make_session) -> None:
    """The one part of setup that needs the API, the worker and a model. It is a button,
    never a step, and it has to fail in a way that explains itself rather than hanging."""
    session, _, _ = make_session(0)

    class Silent:
        def search(self, _queries):
            return []

    session.assessor.retriever = Silent()

    with pytest.raises(Exception) as raised:
        session.suggest_searches()

    assert "rag worker" in str(raised.value)


# --- the config the page writes ---------------------------------------------


def test_a_written_config_keeps_its_comments(tmp_path) -> None:
    """The difference between a file you can keep hand-editing and one taken over."""
    path = tmp_path / "applier.yaml"
    config = load_or_create(path)
    config.candidate.facts["Notice period"] = "1 month"
    save(config)

    text = path.read_text(encoding="utf-8")

    assert "# applier — written by you, and by the page" in text
    assert "answered from these facts and from nothing else" in text
    assert "Notice period: 1 month" in text


def test_a_relative_state_dir_stays_relative(tmp_path) -> None:
    """Read as absolute so the tool works; written as it was, so the file stays portable."""
    path = tmp_path / "applier.yaml"
    config = load_or_create(path)
    assert config.state_dir.is_absolute()

    save(config)

    assert "state_dir: .applier" in path.read_text(encoding="utf-8")


@pytest.mark.parametrize(
    ("fact", "answer"),
    [
        ("Valid driving licence", "No"),
        ("Right to work in Singapore", "Yes"),
        ("Expected monthly salary", "7000"),
        ("Earliest start date", "2026-01-05"),
        ("Willing to relocate", "false"),
        ("Second language", "null"),
        ("Remote preference", "on"),
    ],
)
def test_an_answer_survives_being_written_down(tmp_path, fact: str, answer: str) -> None:
    """The answers people actually give are exactly the ones YAML mangles.

    "Do you have a driving licence?" is answered *No*, and bare ``No`` reads back as the
    boolean false — so the fact would return as ``False`` and the config would stop loading
    at all. A salary reads back as an integer and gets typed into a text field as one. Every
    value whose own spelling would not survive the trip is written quoted.
    """
    path = tmp_path / "applier.yaml"
    config = load_or_create(path)
    config.candidate.facts[fact] = answer
    save(config)

    assert load(path).candidate.facts[fact] == answer


def test_the_facts_editor_is_not_shown_the_synthesised_ones(make_session) -> None:
    """Name, email and phone are offered to the answerer as facts, and edited elsewhere.

    Listing them in the facts editor would invite saving a second copy of each, which then
    drifts from the real one and gives the model two answers to the same question.
    """
    session, _, _ = make_session(0)
    session.update_profile({"name": "Tester", "email": "t@example.com"})

    shown = session.describe()["candidate"]["facts"]

    assert "Full name" not in shown
    assert "Email" not in shown
    assert shown == {"Notice period": "1 month"}
    # They are still there for answering with, which is the point of them.
    assert session.answerer.facts["Full name"] == "Tester"


def test_a_fact_removed_on_the_page_leaves_the_file(tmp_path) -> None:
    path = tmp_path / "applier.yaml"
    config = load_or_create(path)
    config.candidate.facts = {"Keep": "this", "Drop": "that"}
    save(config)

    config = load(path)
    del config.candidate.facts["Drop"]
    save(config)

    text = path.read_text(encoding="utf-8")
    assert "Keep: this" in text
    assert "Drop" not in text


def test_a_config_that_would_not_load_is_refused_whole(make_session) -> None:
    """The raw editor must not be able to leave the tool unable to start."""
    session, _, _ = make_session(0)
    before = session.config.source_path.read_text(encoding="utf-8")

    with pytest.raises(Exception) as raised:
        session.write_config_text("policy:\n  min_score: 900\n")

    assert "min_score" in str(raised.value)
    assert session.config.source_path.read_text(encoding="utf-8") == before, "nothing written"


def test_a_valid_config_from_the_editor_takes_effect_at_once(make_session) -> None:
    session, _, _ = make_session(0)

    session.write_config_text(
        "searches:\n"
        "  - board: fake\n"
        "    keywords: rewritten\n"
        "candidate:\n"
        "  name: Edited\n"
        "  facts:\n"
        "    Notice period: 2 months\n"
        "state_dir: state\n"
    )

    assert session.config.candidate.name == "Edited"
    assert session.config.searches[0].keywords == "rewritten"
    assert session.answerer.facts["Notice period"] == "2 months"


def test_bad_yaml_says_where(tmp_path) -> None:
    with pytest.raises(ConfigError) as raised:
        parse("searches: [\n", where="that config")
    assert "not valid YAML" in str(raised.value)


# --- how often it stops to ask ----------------------------------------------


# What the fake board's form asks. The first is required, which is what makes it able to
# leave a run with nothing to say.
SALARY = "Expected monthly salary (SGD)"
LICENCE = "Do you have a valid driving licence?"


def unanswerable(session) -> None:
    """Leaves a required question with no fact behind it, as a real form regularly does."""
    from applier.errors import UnanswerableError

    def answer(handles, *, role):
        raise UnanswerableError([SALARY])

    session.answerer.answer = answer
    session.answerer.last = None


def test_never_skips_the_posting_and_records_the_question(make_session) -> None:
    session, _board, _ = make_session(1, answers="never")
    unanswerable(session)
    session.start()

    wait_for(lambda: state_at(session, "fake:0") == "needs_input", "it should be skipped")
    assert session.ledger.get("fake:0").questions == [SALARY]


def test_missing_stops_and_asks(make_session) -> None:
    """The default, and the thing that was asked for: not enough information means intervene."""
    session, _, _ = make_session(1, answers="missing")
    unanswerable(session)
    session.start()

    wait_for(lambda: state_at(session, "fake:0") == "reviewing", "it should stop and ask")
    asked = next(job for job in session.jobs() if job["key"] == "fake:0")["review"]

    assert [one["question"] for one in asked] == [SALARY, LICENCE], "the whole form is shown"
    missing = [one["question"] for one in asked if one["unanswered"]]
    assert missing == [SALARY], "and which of it is missing"

    session.decide_review("fake:0", {"action": "discard"})
    wait_for(lambda: state_at(session, "fake:0") == "skipped", "discarding should settle it")


def test_a_fact_typed_into_a_pause_is_kept_for_good(make_session) -> None:
    session, _, _ = make_session(1, answers="missing")
    unanswerable(session)
    session.start()
    wait_for(lambda: state_at(session, "fake:0") == "reviewing", "it should stop and ask")

    session.add_facts({"Expected monthly salary": "SGD 7,000"})

    assert session.answerer.facts["Expected monthly salary"] == "SGD 7,000"
    # Read back off disk: the next run, from here or from the command line, has it too.
    saved = load(session.config.source_path)
    assert saved.candidate.facts["Expected monthly salary"] == "SGD 7,000"
    session.decide_review("fake:0", {"action": "discard"})


def test_always_asks_even_when_nothing_is_missing(make_session) -> None:
    session, _, _ = make_session(1, answers="always")
    session.start()

    wait_for(lambda: state_at(session, "fake:0") == "reviewing", "it should ask regardless")
    session.decide_review("fake:0", {"action": "approve", "answers": {"q1": "7000", "q2": "No"}})

    wait_for(lambda: state_at(session, "fake:0") == "applied", "approving should let it through")


def test_approving_without_answering_a_required_question_is_refused(make_session) -> None:
    """The check does not relax because a person pressed the button.

    Approving is permission to send what is on the screen, not permission to send a form with
    a required question left empty — which the board would refuse anyway, at the far end of a
    filled-in application.
    """
    session, board, _ = make_session(1, answers="always")
    session.start()
    wait_for(lambda: state_at(session, "fake:0") == "reviewing", "it should ask")

    session.decide_review("fake:0", {"action": "approve", "answers": {}})

    wait_for(lambda: state_at(session, "fake:0") == "needs_input", "it should still be blocked")
    assert board.applied == [], "and nothing was sent"
