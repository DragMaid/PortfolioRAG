from __future__ import annotations

import json
import stat
from pathlib import Path

import pytest

from applier.config import Config, load
from applier.errors import ConfigError
from applier.secrets import Secrets

MINIMAL = {"searches": [{"keywords": "python"}], "candidate": {"name": "Ada"}}


def config(**overrides) -> Config:
    return Config.model_validate(MINIMAL | overrides)


def test_the_example_config_is_valid(tmp_path: Path):
    example = Path(__file__).parents[1] / "applier.example.yaml"
    loaded = load(example)
    assert loaded.searches[0].board == "jobstreet"
    assert loaded.state_dir == example.parent / ".applier"


def test_thresholds():
    c = config(policy={"min_verdict": "promising", "min_score": 60, "allow_missing_essentials": 0})
    assert c.meets("strong", 90, 0) is None
    assert "verdict partial" in c.meets("partial", 90, 0)
    assert "score 55" in c.meets("promising", 55, 0)
    assert "essential" in c.meets("strong", 90, 1)


def test_exclusions_are_case_insensitive_regexes():
    c = config(policy={"skip_titles": [r"\bintern(ship)?s?\b"], "skip_companies": ["^Acme"]})
    assert c.policy.excluded("Software Intern", None)
    assert c.policy.excluded("Summer Internship", None)
    assert c.policy.excluded("Internal Tools Engineer", None) is None
    assert c.policy.excluded("Engineer", "ACME Pte Ltd")
    assert c.policy.excluded("Engineer", None) is None


def test_a_search_needs_something_to_search_for():
    with pytest.raises(ValueError):
        Config.model_validate(MINIMAL | {"searches": [{"board": "jobstreet"}]})


def test_a_missing_token_is_not_a_reason_to_refuse_to_start(tmp_path, monkeypatch):
    """The page asks for it. Nothing should be unable to load because it has not yet.

    The token used to be read out of the environment the moment a config was used, which
    meant the controller could not start — and so could not show the box that asks for one —
    until it was already there.
    """
    monkeypatch.delenv("APPLIER_PORTFOLIO_TOKEN", raising=False)
    store = Secrets(tmp_path, token_env="APPLIER_PORTFOLIO_TOKEN")

    assert store.portfolio_token == ""
    assert store.portfolio_source is None
    assert store.describe()["tokenSet"] is False


def test_the_token_must_look_like_a_portfolio_token(tmp_path):
    store = Secrets(tmp_path, token_env="APPLIER_PORTFOLIO_TOKEN")

    with pytest.raises(ConfigError, match="pfl_"):
        store.set_portfolio_token("eyJhbGciOi")

    store.set_portfolio_token("pfl_abc")
    assert store.portfolio_token == "pfl_abc"


def test_a_pasted_token_wins_over_the_environment(tmp_path, monkeypatch):
    """The failure this avoids is the quiet one: pasting a fresh token and nothing changing."""
    monkeypatch.setenv("APPLIER_PORTFOLIO_TOKEN", "pfl_from_the_environment")
    store = Secrets(tmp_path, token_env="APPLIER_PORTFOLIO_TOKEN")
    assert store.portfolio_source == "environment"

    store.set_portfolio_token("pfl_pasted")

    assert store.portfolio_token == "pfl_pasted"
    assert store.portfolio_source == "page"

    # Forgetting it hands the environment back, rather than leaving nothing.
    store.forget_portfolio_token()
    assert store.portfolio_token == "pfl_from_the_environment"


def test_a_kept_token_is_readable_only_by_its_owner(tmp_path):
    store = Secrets(tmp_path, token_env="APPLIER_PORTFOLIO_TOKEN")
    store.set_portfolio_token("pfl_abc")

    assert stat.S_IMODE(store.path.stat().st_mode) == 0o600
    assert "pfl_abc" not in json.dumps(store.describe()), "and never described to the page"


def test_a_kept_token_survives_a_restart(tmp_path):
    Secrets(tmp_path, token_env="APPLIER_PORTFOLIO_TOKEN").set_portfolio_token("pfl_abc")

    assert Secrets(tmp_path, token_env="APPLIER_PORTFOLIO_TOKEN").portfolio_token == "pfl_abc"


def test_missing_config_says_what_to_do(tmp_path: Path):
    with pytest.raises(ConfigError, match=r"applier\.example\.yaml"):
        load(tmp_path / "applier.yaml")


def test_candidate_facts_include_contact_details():
    c = config(candidate={"name": "Ada", "email": "a@b.c", "facts": {"Notice period": "1 month"}})
    assert c.candidate.all_facts() == {
        "Full name": "Ada",
        "Email": "a@b.c",
        "Notice period": "1 month",
    }
