"""Reading and filling a form without knowing which board drew it.

A board adapter points at the part of the page that holds the questions; everything below
that is here, so a new board gets question-reading and filling for free. Fields are read by
``js/fields.js`` into :class:`FormField`, answered elsewhere (``answering``), and written
back through Playwright by the ``data-applier-field`` tag the reader left on each control.
"""

from __future__ import annotations

import re
from functools import cache
from importlib.resources import files
from typing import Any

from playwright.sync_api import Locator, Page

from .models import Answer, FormField

# Radios, checkboxes and selects are answered by option text; matched after this.
_SPACE = re.compile(r"\s+")


@cache
def _reader() -> str:
    return files("applier").joinpath("js/fields.js").read_text(encoding="utf-8")


class FieldHandle:
    """A field as read, plus what the filler needs to find its controls."""

    def __init__(self, raw: dict[str, Any]):
        self.members: list[str] = list(raw.get("members") or [raw["id"]])
        self.single_checkbox = bool(raw.get("single_checkbox"))
        self.field = FormField(
            id=raw["id"],
            kind=raw["kind"],
            label=raw.get("label") or "",
            required=bool(raw.get("required")),
            options=list(raw.get("options") or []),
            current=raw.get("current"),
            max_length=raw.get("max_length"),
        )


def read_fields(root: Locator, prefix: str = "f") -> list[FieldHandle]:
    """Every question inside ``root``, in document order."""
    raw = root.evaluate(_reader(), prefix)
    return [FieldHandle(item) for item in raw]


def normalise(text: str) -> str:
    return _SPACE.sub(" ", text).strip().casefold()


def match_option(answer: str, options: list[str]) -> str | None:
    """The option an answer names: exact, then ignoring case and spacing, then a unique prefix.

    Never nearest-neighbour. An answer that names no option is a wrong answer, not a close
    one, and the caller treats it as unanswered.
    """
    if answer in options:
        return answer

    wanted = normalise(answer)
    for option in options:
        if normalise(option) == wanted:
            return option

    prefixed = [option for option in options if normalise(option).startswith(wanted)]
    return prefixed[0] if len(prefixed) == 1 else None


def fill(page: Page, handle: FieldHandle, answer: Answer) -> None:
    """Writes one validated answer into its control(s)."""
    field = handle.field

    def control(member: str) -> Locator:
        return page.locator(f"[data-applier-field='{member}']")

    if field.kind in ("text", "textarea", "number", "date"):
        target = control(handle.members[0])
        target.fill(str(answer))
        return

    if field.kind == "select":
        control(handle.members[0]).select_option(label=str(answer))
        return

    if field.kind == "file":
        control(handle.members[0]).set_input_files(str(answer))
        return

    if handle.single_checkbox:
        box = control(handle.members[0])
        _set_checked(page, box, normalise(str(answer)) == "yes")
        return

    chosen = {answer} if isinstance(answer, str) else set(answer)

    for member in handle.members:
        box = control(member)
        option = box.get_attribute("data-applier-option") or ""
        # Single choice or multi-choice
        if field.kind == "radio":
            if option in chosen:
                _set_checked(page, box, True)
        else:
            _set_checked(page, box, option in chosen)


def _set_checked(page: Page, box: Locator, value: bool) -> None:
    """Checks or unchecks, clicking the label when a custom control hides the input."""
    if box.is_checked() == value:
        return

    try:
        box.set_checked(value, timeout=3_000)
    except Exception:
        # Styled radios hide the input behind their label; clicking the label is what a
        # person does and what the page's own handlers listen for.
        element_id = box.get_attribute("id")
        label = (
            page.locator(f"label[for='{element_id}']")
            if element_id
            else box.locator("xpath=ancestor::label[1]")
        )
        label.first.click()

    if box.is_checked() != value:
        box.set_checked(value, force=True)
