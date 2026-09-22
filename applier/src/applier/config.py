"""The run's configuration, from one YAML file. See ``applier.example.yaml``.

Secrets never live in the file: the portfolio token and any provider key are named by the
environment variable that holds them.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator
from rag.schemas import Verdict

from .errors import ConfigError
from .models import Resume, Search

VERDICTS: tuple[Verdict, ...] = ("weak", "partial", "promising", "strong")


class SearchConfig(BaseModel):
    board: str = "jobstreet"
    keywords: str = ""
    location: str | None = None
    date_range: int | None = Field(default=7, description="Only postings listed this many days.")
    url: str | None = Field(default=None, description="A board search URL, used as-is.")
    max_pages: int = Field(default=2, ge=1, le=20)

    @model_validator(mode="after")
    def _something_to_search(self) -> SearchConfig:
        if not self.keywords.strip() and not self.url:
            raise ValueError("a search needs keywords or a url")
        return self

    def to_search(self) -> Search:
        return Search(**self.model_dump())


class PolicyConfig(BaseModel):
    """What counts as a fit, and how hard a run may go. Every threshold is applied in code."""

    min_verdict: Verdict = "promising"
    min_score: int = Field(default=60, ge=0, le=100)
    # Any essential requirement the portfolio shows no evidence of at all.
    allow_missing_essentials: int = Field(default=1, ge=0)
    max_applications: int = Field(default=10, ge=0, description="Submitted, per run.")
    max_assessments: int = Field(default=30, ge=0, description="Postings assessed, per run.")
    delay_seconds: tuple[float, float] = (20.0, 60.0)
    skip_titles: list[str] = Field(default_factory=list, description="Regexes, case-insensitive.")
    skip_companies: list[str] = Field(default_factory=list, description="Regexes, too.")

    @field_validator("skip_titles", "skip_companies")
    @classmethod
    def _compiles(cls, patterns: list[str]) -> list[str]:
        for pattern in patterns:
            re.compile(pattern)
        return patterns

    def excluded(self, title: str, company: str | None) -> str | None:
        """Why the policy rules a listing out before it is assessed, or None."""
        for pattern in self.skip_titles:
            if re.search(pattern, title, re.IGNORECASE):
                return f"title matches {pattern!r}"
        for pattern in self.skip_companies:
            if company and re.search(pattern, company, re.IGNORECASE):
                return f"company matches {pattern!r}"
        return None


class LlmConfig(BaseModel):
    """Which model does the reading and writing.

    ``web`` drives a chat site you are signed in to, exactly as ``rag-local`` does: no key,
    nothing billed. Anything else is one of rag's registered providers, with its key read
    from ``api_key_env``.
    """

    provider: str = "web"
    site: str = "gemini"
    browser: Literal["camoufox", "chrome"] = "camoufox"
    headless: bool = True
    model: str | None = None
    api_key_env: str | None = None

    def api_key(self) -> str:
        if self.provider == "web":
            return ""
        name = self.api_key_env or f"{self.provider.upper()}_API_KEY"
        if not (value := os.environ.get(name, "").strip()):
            raise ConfigError(f"The {self.provider} provider needs a key in ${name}.")
        return value


class PortfolioConfig(BaseModel):
    api: str = "http://localhost:5009"
    token_env: str = "APPLIER_PORTFOLIO_TOKEN"

    def token(self) -> str:
        value = os.environ.get(self.token_env, "").strip()
        if not value.startswith("pfl_"):
            raise ConfigError(
                f"Put a portfolio API token (pfl_…, write scope, from the studio's access tab) "
                f"in ${self.token_env}. It is what retrieval runs under."
            )
        return value


class BrowserConfig(BaseModel):
    """The job board's browser. Separate from the chat site's, with its own profile."""

    headless: bool = False
    # Every page of every apply flow saved to disk, not only the ones that failed.
    capture_steps: bool = False


class ResumeConfig(BaseModel):
    select: str | None = None
    upload: Path | None = None

    @model_validator(mode="after")
    def _one(self) -> ResumeConfig:
        if self.select and self.upload:
            raise ValueError("resume takes select or upload, not both")
        if self.upload and not self.upload.expanduser().is_file():
            raise ValueError(f"resume upload {self.upload} is not a file")
        return self


class CandidateConfig(BaseModel):
    """The facts employer questions are answered from, and nothing else is.

    Anything a question needs that is not here makes the posting skip rather than guess.
    """

    name: str
    email: str | None = None
    phone: str | None = None
    resume: ResumeConfig = Field(default_factory=ResumeConfig)
    facts: dict[str, str] = Field(default_factory=dict)
    cover_letter_notes: str | None = Field(
        default=None, description="Handed to the letter writer, as rag-local's notes box is."
    )

    def to_resume(self) -> Resume:
        upload = self.resume.upload.expanduser().resolve() if self.resume.upload else None
        return Resume(select=self.resume.select, upload=upload)

    def all_facts(self) -> dict[str, str]:
        facts = {"Full name": self.name}
        if self.email:
            facts["Email"] = self.email
        if self.phone:
            facts["Phone"] = self.phone
        return facts | self.facts


class BoardsConfig(BaseModel):
    """Per-board settings, passed to the board's constructor untouched."""

    jobstreet: dict = Field(default_factory=lambda: {"region": "sg"})

    model_config = {"extra": "allow"}

    def for_board(self, name: str) -> dict:
        return dict(getattr(self, name, None) or {})


class Config(BaseModel):
    searches: list[SearchConfig]
    candidate: CandidateConfig
    policy: PolicyConfig = Field(default_factory=PolicyConfig)
    llm: LlmConfig = Field(default_factory=LlmConfig)
    portfolio: PortfolioConfig = Field(default_factory=PortfolioConfig)
    browser: BrowserConfig = Field(default_factory=BrowserConfig)
    boards: BoardsConfig = Field(default_factory=BoardsConfig)
    state_dir: Path = Path(".applier")
    # Where this was read from. Set by ``load``; the page states it rather than guessing.
    source_path: Path | None = None

    def meets(self, verdict: Verdict, score: int, missing_essentials: int) -> str | None:
        """Why an assessed posting falls short of the policy, or None if it is a fit."""
        policy = self.policy

        if VERDICTS.index(verdict) < VERDICTS.index(policy.min_verdict):
            return f"verdict {verdict} is below {policy.min_verdict}"
        if score < policy.min_score:
            return f"score {score} is below {policy.min_score}"
        if missing_essentials > policy.allow_missing_essentials:
            return (
                f"{missing_essentials} essential requirements have no evidence "
                f"(allowed {policy.allow_missing_essentials})"
            )
        return None


def load(path: Path) -> Config:
    if not path.is_file():
        raise ConfigError(
            f"No config at {path}. Copy applier.example.yaml to {path.name} and fill it in."
        )

    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        config = Config.model_validate(raw)
    except yaml.YAMLError as error:
        raise ConfigError(f"{path} is not valid YAML: {error}") from error
    except ValidationError as error:
        raise ConfigError(f"{path} is not a valid config:\n{error}") from error

    # Relative paths in the file mean relative to the file, not to wherever it was run from.
    base = path.resolve().parent
    config.source_path = path.resolve()
    if not config.state_dir.is_absolute():
        config.state_dir = base / config.state_dir
    if (upload := config.candidate.resume.upload) and not upload.expanduser().is_absolute():
        config.candidate.resume.upload = base / upload

    return config
