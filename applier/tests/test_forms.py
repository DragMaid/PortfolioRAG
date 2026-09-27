"""The form reader and filler, in a real camoufox, against a page shaped like the forms
boards draw: labelled inputs, a fieldset of styled radios whose inputs are hidden, a lone
consent checkbox, a select with a placeholder, and a group labelled by aria-labelledby.

Marked ``browser``: it launches camoufox, so it is out of the default run.
"""

from __future__ import annotations

import pytest

from applier.forms import fill, read_fields

pytestmark = pytest.mark.browser

PAGE = """
<form>
  <label for="salary">Expected monthly salary (SGD)</label>
  <input id="salary" type="number" required>

  <fieldset>
    <legend>Do you have the right to work in Singapore?</legend>
    <input type="radio" name="rtw" id="rtw-yes" style="opacity:0;position:absolute">
    <label for="rtw-yes">Yes</label>
    <input type="radio" name="rtw" id="rtw-no" style="display:none">
    <label for="rtw-no">No</label>
  </fieldset>

  <span id="langs">Which languages do you speak?</span>
  <div role="group" aria-labelledby="langs">
    <label><input type="checkbox" name="lang" value="en"> English</label>
    <label><input type="checkbox" name="lang" value="zh" checked> Mandarin</label>
    <label><input type="checkbox" name="lang" value="ms"> Malay</label>
  </div>

  <label for="notice">Notice period</label>
  <select id="notice" aria-required="true">
    <option value="">Select…</option>
    <option value="0">Immediately</option>
    <option value="1">1 month</option>
  </select>

  <label><input type="checkbox" id="consent"> I agree to be contacted</label>

  <input type="hidden" name="csrf" value="x">
  <button type="submit">Continue</button>
</form>
"""


@pytest.fixture(scope="module")
def page():
    from camoufox.sync_api import Camoufox

    with Camoufox(headless=True, i_know_what_im_doing=True) as browser:
        page = browser.new_page()
        page.set_content(PAGE)
        yield page


def test_read_fields(page):
    fields = {h.field.label: h for h in read_fields(page.locator("form"), prefix="q")}

    assert set(fields) == {
        "Expected monthly salary (SGD)",
        "Do you have the right to work in Singapore?",
        "Which languages do you speak?",
        "Notice period",
        "I agree to be contacted",
    }

    salary = fields["Expected monthly salary (SGD)"].field
    assert (salary.kind, salary.required) == ("number", True)

    rtw = fields["Do you have the right to work in Singapore?"].field
    assert (rtw.kind, rtw.options) == ("radio", ["Yes", "No"])

    langs = fields["Which languages do you speak?"].field
    assert langs.kind == "checkbox"
    assert langs.options == ["English", "Mandarin", "Malay"]
    assert langs.current == ["Mandarin"]

    notice = fields["Notice period"].field
    assert (notice.kind, notice.options, notice.required) == (
        "select",
        ["Immediately", "1 month"],
        True,
    )
    assert notice.current is None

    consent = fields["I agree to be contacted"]
    assert consent.single_checkbox
    assert consent.field.options == ["Yes", "No"]


def test_fill(page):
    fields = {h.field.label: h for h in read_fields(page.locator("form"), prefix="r")}

    fill(page, fields["Expected monthly salary (SGD)"], "6000")
    fill(page, fields["Do you have the right to work in Singapore?"], "Yes")
    fill(page, fields["Which languages do you speak?"], ["English", "Malay"])
    fill(page, fields["Notice period"], "1 month")
    fill(page, fields["I agree to be contacted"], "Yes")

    assert page.locator("#salary").input_value() == "6000"
    assert page.locator("#rtw-yes").is_checked()
    assert not page.locator("#rtw-no").is_checked()
    checked = page.eval_on_selector_all(
        "input[name=lang]", "els => els.filter(e => e.checked).map(e => e.value)"
    )
    assert checked == ["en", "ms"]
    assert page.locator("#notice").input_value() == "1"
    assert page.locator("#consent").is_checked()
