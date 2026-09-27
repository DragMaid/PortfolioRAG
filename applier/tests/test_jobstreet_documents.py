"""JobStreet's documents step, in camoufox, on a page built like the real one.

The shape is copied from a capture of sg.jobstreet.com in September 2026, when a run stopped
with "Did not recognise this step": the step was served at ``/job/<id>/apply`` itself and
named only in the tab title and the progress stepper, and resumes had become a radio list
labelled by file name, with *Upload* behind a hidden file input.

Marked ``browser``: it launches camoufox, so it is out of the default run.
"""

from __future__ import annotations

import pytest

from applier.boards.jobstreet import JobStreet
from applier.browser import BrowserSession
from applier.models import Resume

pytestmark = pytest.mark.browser

PAGE = """<!doctype html><title>Choose documents | Jobstreet</title>
<header><nav><a href="#">Job search</a></nav></header>
<main>
  <h1>Senior / Software Engineer (Java)</h1>
  <ol>
    <li aria-current="step">Choose documents</li>
    <li>Answer employer questions</li>
    <li>Review and submit</li>
  </ol>
  <h3>Resumé</h3>
  <fieldset id="resumes">
    <div><input type="radio" id="r1" name="document-select" value="a1" checked>
      <label for="r1"><span>swe-cs.pdf</span></label></div>
    <div><input type="radio" id="r2" name="document-select" value="a2">
      <label for="r2"><span>old-resume.pdf</span></label></div>
    <div><input type="radio" id="r0" name="document-select" value="dont-include">
      <label for="r0"><span>Don't include a resumé</span></label></div>
  </fieldset>
  <div data-testid="resumeFileInput">
    <input id="resume-fileFile" type="file" style="display:none" accept=".pdf,.docx">
  </div>
  <h3>Cover letter</h3>
  <input type="radio" id="c1" name="coverLetter-method" value="upload">
  <label for="c1">Upload a cover letter</label>
  <input type="radio" id="c2" name="coverLetter-method" value="change">
  <label for="c2">Write a cover letter</label>
  <input type="radio" id="c3" name="coverLetter-method" value="none" checked>
  <label for="c3">Don't include a cover letter</label>
  <div id="letter"></div>
  <button type="button">Continue</button>
</main>
<script>
  // Uploading adds the file to the list, chosen — as JobStreet does once it has it.
  document.getElementById("resume-fileFile").addEventListener("change", (event) => {
    const name = event.target.files[0].name;
    setTimeout(() => {
      const row = document.createElement("div");
      row.innerHTML = `<input type="radio" id="r9" name="document-select" value="new">` +
        `<label for="r9"><span>${name}</span></label>`;
      document.getElementById("resumes").prepend(row);
      document.getElementById("r9").checked = true;
    }, 300);
  });
  document.getElementById("c2").addEventListener("change", () => {
    document.getElementById("letter").innerHTML = '<textarea maxlength="2000"></textarea>';
  });
</script>"""


@pytest.fixture(scope="module")
def board(tmp_path_factory):
    where = tmp_path_factory.mktemp("jobstreet")
    session = BrowserSession(profile=where / "p", captures=where / "c", headless=True).open()
    board = JobStreet("sg")
    board.attach(session)
    yield board
    session.close()


@pytest.fixture
def page(board):
    board.browser.page.set_content(PAGE)
    return board.browser.page


def checked(page, name: str) -> str:
    return page.eval_on_selector(f"input[name='{name}']:checked", "(el) => el.value")


def test_the_step_is_recognised_by_its_title_and_stepper(board, page):
    assert board._step() == "documents"


def test_the_resumes_on_the_profile_are_read_by_file_name(board, page):
    assert board._resume_names() == ["swe-cs.pdf", "old-resume.pdf"]


def test_one_already_on_the_profile_is_chosen_by_part_of_its_name(board, page):
    board._documents(None, Resume(select="old-resume"))
    assert checked(page, "document-select") == "a2"


def test_a_resume_nobody_uploaded_is_an_error_that_says_so(board, page):
    from applier.errors import FlowError

    with pytest.raises(FlowError, match="named like 'missing'"):
        board._documents(None, Resume(select="missing"))


def test_a_file_is_uploaded_and_then_chosen(board, page, tmp_path):
    resume = tmp_path / "Tester_Resume.pdf"
    resume.write_bytes(b"%PDF-1.4 a resume")

    board._documents(None, Resume(upload=resume))

    assert page.eval_on_selector("#resume-fileFile", "(el) => el.files[0].name") == resume.name
    assert checked(page, "document-select") == "new"


def test_a_file_uploaded_before_is_chosen_not_uploaded_again(board, page, tmp_path):
    resume = tmp_path / "swe-cs.pdf"
    resume.write_bytes(b"%PDF-1.4")
    page.check("#r2")

    board._documents(None, Resume(upload=resume))

    assert checked(page, "document-select") == "a1"
    assert page.eval_on_selector("#resume-fileFile", "(el) => el.files.length") == 0


def test_no_letter_means_dont_include_one(board, page):
    page.check("#c2")
    board._documents(None, Resume())
    assert checked(page, "coverLetter-method") == "none"


def test_a_letter_is_written_into_the_box(board, page):
    board._documents("Dear Maestro,", Resume())
    assert checked(page, "coverLetter-method") == "change"
    assert page.input_value("textarea") == "Dear Maestro,"


# --- the questions step ------------------------------------------------------

# As captured in September 2026: named by the tab title and the stepper, and drawn a moment
# after the title changes — which is when a first attempt read it, found nothing, and waited
# thirty seconds for a <main> the page does not have.
QUESTIONS = """<!doctype html><title>Answer employer questions | Jobstreet</title>
<nav><ol><li aria-current="step">Answer employer questions</li></ol></nav>
<div id="root"></div>
<script>
  setTimeout(() => {
    document.getElementById("root").innerHTML = `<form>
      <fieldset role="radiogroup" aria-labelledby="l1"><legend id="l1"><strong>
        Which of the following statements best describes your right to work in Singapore?
      </strong></legend>
        <input type="radio" id="a1" name="questionnaire.Q1" value="1">
        <label for="a1">I'm a Singaporean citizen</label>
        <input type="radio" id="a2" name="questionnaire.Q1" value="2">
        <label for="a2">I require sponsorship to work for a new employer in Singapore</label>
      </fieldset>
      <label for="q2">How many years' experience do you have?</label>
      <select id="q2" name="questionnaire.Q2"><option value=""></option>
        <option>1 year</option><option>2 years</option></select>
      <button type="button" data-testid="continue-button"><span>Continue</span></button>
    </form>`;
  }, 1500);
</script>"""


def test_questions_drawn_after_the_title_are_waited_for_and_all_required(board):
    board.browser.page.set_content(QUESTIONS)

    assert board._step() == "questions"
    fields = [handle.field for handle in board._read_questions()]

    assert [field.kind for field in fields] == ["radio", "select"]
    assert fields[0].label.startswith("Which of the following statements")
    assert fields[1].options == ["1 year", "2 years"]
    assert all(field.required for field in fields), "a blank one would not continue"
