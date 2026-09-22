"""What every board adapter has to be true of, checked without opening one.

A board is the one part of this that cannot be unit tested against a real page: it exists to
know a website's shape, and that website is not here. So the useful checks are structural,
and they are worth having precisely because nothing else covers this code until somebody runs
a real application through it.

The bug that prompted the first of these: ``apply`` was given a probing branch that called
``self._read_questions()`` and ``self._resume_names()``, and neither method was ever added.
Nothing caught it. Ruff does not resolve attributes, the type checker was not run over it,
and every test in this suite drives a fake board — so the first thing to notice would have
been a live setup run dying halfway through a real employer's form.
"""

from __future__ import annotations

import ast
import inspect
import textwrap
from pathlib import Path

import pytest

from applier import boards as registry
from applier.boards.base import JobBoard


def board_classes() -> list[type]:
    return [factory for factory in registry.BOARDS.values() if isinstance(factory, type)]


def names(board: type) -> list[str]:
    return [f"{board.__module__}.{board.__name__}"]


@pytest.mark.parametrize("board", board_classes(), ids=lambda board: board.name)
def test_every_method_a_board_calls_on_itself_exists(board: type) -> None:
    """``self._something(...)`` in a board's own source has to resolve to something.

    A call site added without its definition is the easiest mistake to make here and among
    the hardest to notice, because the code path that reaches it needs a real browser on a
    real posting.
    """
    tree = ast.parse(textwrap.dedent(inspect.getsource(board)))

    def on_self(node: ast.AST) -> str | None:
        """The attribute name, when this node is ``self.<name>``."""
        if (
            isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name)
            and node.value.id == "self"
        ):
            return node.attr
        return None

    called = {
        name
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and (name := on_self(node.func))
    }

    # A callable handed in and kept — ``self._make_browser = make_browser`` — is defined on
    # the instance, not the class, so hasattr on the class would report it missing. Anything
    # assigned to self anywhere in the class counts as defined.
    assigned = {
        name
        for node in ast.walk(tree)
        if isinstance(node, ast.Assign | ast.AnnAssign)
        for target in ([node.target] if isinstance(node, ast.AnnAssign) else node.targets)
        if (name := on_self(target))
    }

    missing = sorted(name for name in called - assigned if not hasattr(board, name))
    assert not missing, (
        f"{board.__name__} calls {missing} on itself and defines none of them. A call site "
        f"added without its method only shows up on a real posting, in a real browser."
    )


@pytest.mark.parametrize("board", board_classes(), ids=lambda board: board.name)
def test_every_board_satisfies_the_contract(board: type) -> None:
    """The whole of what the pipeline and the controller are written against."""
    assert isinstance(board, type) and issubclass(board, object)

    for method in ("attach", "ensure_signed_in", "is_signed_in", "search", "fetch", "apply"):
        assert callable(getattr(board, method, None)), f"{board.__name__} has no {method}"

    # `submitted` is what lets a hand-off you completed yourself settle its own row, and
    # `listing_for` is what `applier apply <url>` needs. Both are easy to forget on a new
    # adapter because neither is on the path a first run exercises.
    assert callable(getattr(board, "submitted", None)), "a hand-off could never settle itself"
    assert callable(getattr(board, "listing_for", None))


@pytest.mark.parametrize("board", board_classes(), ids=lambda board: board.name)
def test_a_board_is_recognised_as_one(board: type) -> None:
    instance = board()
    assert isinstance(instance, JobBoard)
    assert instance.name and instance.login_url.startswith("https://")


def test_the_registry_agrees_with_itself() -> None:
    for name, factory in registry.BOARDS.items():
        assert factory.name == name, f"{factory} is registered under {name!r}"
        assert registry.create(name).name == name


def test_an_unknown_board_says_which_ones_there_are() -> None:
    with pytest.raises(ValueError, match="jobstreet"):
        registry.create("linkedin")


def test_probing_is_part_of_the_apply_flow_not_beside_it() -> None:
    """A probe has to walk the same steps a real application does, or it reads a form nobody
    will ever be shown. Every adapter honours it inside ``apply``; none gets its own path."""
    for board in board_classes():
        source = inspect.getsource(board.apply)
        assert "context.probe" in source, f"{board.__name__}.apply ignores probing"
        assert "probe=Probe(" in source, f"{board.__name__}.apply reports no Probe"


def test_selectors_stay_out_of_the_shared_code() -> None:
    """A board's knowledge of a website belongs in that board's package.

    ``forms``, ``answering`` and the controller are written against any board; a selector or
    a host leaking into them is how a second board starts being a special case of the first.
    A board *name* is fine and appears in the config as a default — what must not appear is
    anything about a particular site's pages.
    """
    shared = Path(__file__).resolve().parents[1] / "src" / "applier"
    suspicious = ("jobstreet.com", "seek.com", "linkedin.com", "data-automation")

    for path in [*shared.glob("*.py"), *(shared / "controller").glob("*.py")]:
        text = path.read_text(encoding="utf-8").lower()
        for marker in suspicious:
            assert marker not in text, f"{path.name} mentions {marker!r}"
