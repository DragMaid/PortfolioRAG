"""The run's configuration, from one YAML file. See ``applier.example.yaml``.

The file is the single source of truth and both ends write it: you, in an editor, and the
controller, when you change something on its settings page or answer the questions its setup
run found. :func:`save` goes through ruamel's round-trip loader, so comments, ordering and
the shape of what you wrote survive a save from the page — a config you hand-edited is still
the config you hand-edited afterwards.

Nothing here has to be filled in for the tool to start. :func:`load_or_create` writes a
skeleton when there is no file at all, and every field below has a default, because the
setup run exists precisely so that nobody has to write this by hand first.

Secrets never live in the file: the portfolio token and any provider key are named by the
environment variable that holds them, and the page only ever reports whether that variable
is set.
"""

from __future__ import annotations

import io
import os
import re
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator
from rag.schemas import Verdict
from ruamel.yaml import YAML
from ruamel.yaml.error import YAMLError
from ruamel.yaml.scalarstring import DoubleQuotedScalarString

from .errors import ConfigError
from .models import Resume, Search

VERDICTS: tuple[Verdict, ...] = ("weak", "partial", "promising", "strong")

# How much an unanswerable employer question is allowed to happen without you.
Intervention = Literal["never", "missing", "always"]
# Who sends an application that clears the policy: the board's adapter, or you.
ApplyMode = Literal["auto", "manual"]


class SearchConfig(BaseModel):
    board: str = "jobstreet"
    keywords: str = ""
    location: str | None = None
    date_range: int | None = Field(default=7, description="Only postings listed this many days.")
    url: str | None = Field(default=None, description="A board search URL, used as-is.")
    max_pages: int = Field(default=2, ge=1, le=20)
    # Unticked on the page. Kept in the file rather than dropped, so a search you are not
    # running this week is still there next week.
    enabled: bool = True

    @model_validator(mode="after")
    def _something_to_search(self) -> SearchConfig:
        if not self.keywords.strip() and not self.url:
            raise ValueError("a search needs keywords or a url")
        return self

    def to_search(self) -> Search:
        return Search(**self.model_dump(exclude={"enabled"}))


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


class RunConfig(BaseModel):
    """How much of a run happens without you. The page's toggles, kept in the file.

    ``apply_mode`` says who sends an application that clears the policy:

    * ``auto`` — the board's own adapter fills and submits it, unattended, in the board's
      browser. Only a posting the board can take in its own form (JobStreet's quick apply)
      goes this way; a link-out to an employer's site always goes to the manual queue.
    * ``manual`` — every fit goes to the manual queue, with its report and cover letter, to
      be opened in your own browser, where the extension fills the form for you to send.

    ``board_modes`` overrides it per board: ``{jobstreet: manual}``.

    ``answers`` is the one that matters most. The answerer throws out anything the model
    could not point at a fact you wrote down; this says what happens next:

    * ``never`` — the posting is skipped and the question recorded. Unattended, and what the
      command line does.
    * ``missing`` — the run stops and asks you, there and then, and the answer you give is
      remembered from then on. The default: a question nobody answered is the one thing
      worth your time.
    * ``always`` — every question and its answer is shown before the form is filled.
    """

    auto_pick: bool = Field(default=True, description="False: every fit waits to be picked.")
    apply_mode: ApplyMode = "auto"
    board_modes: dict[str, ApplyMode] = Field(default_factory=dict)
    answers: Intervention = "missing"

    @model_validator(mode="before")
    @classmethod
    def _from_auto_submit(cls, data: Any) -> Any:
        """Configs written before the manual queue said ``auto_submit``. Read it once; the
        next save writes ``apply_mode`` in its place."""
        if isinstance(data, dict) and "auto_submit" in data:
            data = dict(data)
            submit = data.pop("auto_submit")
            data.pop("max_open_handoffs", None)
            data.setdefault("apply_mode", "auto" if submit in (True, None) else "manual")
        elif isinstance(data, dict):
            data = {key: value for key, value in data.items() if key != "max_open_handoffs"}
        return data

    def mode_for(self, board: str) -> ApplyMode:
        return self.board_modes.get(board, self.apply_mode)


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

    @property
    def key_variable(self) -> str:
        return self.api_key_env or f"{self.provider.upper()}_API_KEY"

    def key_is_set(self) -> bool:
        """Whether the key this is configured to use is in the environment. No key is read."""
        return self.provider == "web" or bool(os.environ.get(self.key_variable, "").strip())

    def api_key(self) -> str:
        if self.provider == "web":
            return ""
        name = self.key_variable
        if not (value := os.environ.get(name, "").strip()):
            raise ConfigError(f"The {self.provider} provider needs a key in ${name}.")
        return value


class PortfolioConfig(BaseModel):
    """Where retrieval runs, and where its token could come from.

    The token itself is not here and never has been: see :mod:`applier.secrets`. This only
    names the environment variable it may be exported as, for anyone who prefers that to
    pasting it into the page.
    """

    api: str = "https://api.blograg.pbh-dev.tech"
    token_env: str = "APPLIER_PORTFOLIO_TOKEN"


class BrowserConfig(BaseModel):
    """The job board's browser. Separate from the chat site's, with its own profile.

    ``headless`` hides it until a person is needed — a sign-in, a bot check — when a window
    comes up for that and goes away again after. False keeps a window up throughout.
    """

    headless: bool = True
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

    name: str = ""
    email: str | None = None
    phone: str | None = None
    resume: ResumeConfig = Field(default_factory=ResumeConfig)
    facts: dict[str, str] = Field(default_factory=dict)
    # False leaves the cover letter out of every application, and none is written.
    cover_letter: bool = True
    cover_letter_notes: str | None = Field(
        default=None, description="Handed to the letter writer, as rag-local's notes box is."
    )
    answer_notes: str | None = Field(
        default=None,
        description=(
            "Handed to the employer-question answerer. Steers wording and which option to "
            "take where two fit; it is not a fact, and grants nothing — an answer still has "
            "to point at something under `facts`."
        ),
    )

    def to_resume(self) -> Resume:
        upload = self.resume.upload.expanduser().resolve() if self.resume.upload else None
        return Resume(select=self.resume.select, upload=upload)

    def all_facts(self) -> dict[str, str]:
        facts = {"Full name": self.name} if self.name else {}
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
    searches: list[SearchConfig] = Field(default_factory=list)
    candidate: CandidateConfig = Field(default_factory=CandidateConfig)
    run: RunConfig = Field(default_factory=RunConfig)
    policy: PolicyConfig = Field(default_factory=PolicyConfig)
    llm: LlmConfig = Field(default_factory=LlmConfig)
    portfolio: PortfolioConfig = Field(default_factory=PortfolioConfig)
    browser: BrowserConfig = Field(default_factory=BrowserConfig)
    boards: BoardsConfig = Field(default_factory=BoardsConfig)
    state_dir: Path = Path(".applier")
    # Set once the setup run has been answered or deliberately skipped. Until then the page
    # opens on the wizard rather than on a table that has nothing to put in it.
    setup_done: bool = False
    # Where this was read from. Set by ``load``; the page states it rather than guessing.
    source_path: Path | None = Field(default=None, exclude=True)
    # A relative path in the file means relative to the file, so both are made absolute on
    # the way in. These remember what the file actually said, so that saving writes back the
    # `.applier` you wrote and not this machine's copy of where that landed.
    written_paths: dict[str, str] = Field(default_factory=dict, exclude=True)

    def enabled_searches(self) -> list[tuple[int, SearchConfig]]:
        return [(index, s) for index, s in enumerate(self.searches) if s.enabled]

    def ready(self, *, has_token: bool = True) -> list[str]:
        """What still has to be true before a run could do anything. Empty means go."""
        missing = []
        if not has_token:
            missing.append("a portfolio API token")
        if not self.candidate.name.strip():
            missing.append("a name")
        if not self.candidate.facts:
            missing.append("some facts to answer employer questions from")
        if not self.enabled_searches():
            missing.append("at least one search")
        return missing

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


_SKELETON = """\
# applier — written by you, and by the page. Both keep it: saving from the settings tab
# goes through a round-trip loader, so these comments, your key order and anything you add
# below all stay put.
#
# Nothing here has to be filled in by hand. Run `applier serve`: the setup run does one mock
# application, asks you the questions it finds on the form, and writes the answers in here.

# What to look for. Add them on the settings page, or here — keywords and an optional
# location, or `url:` with a search you have already refined in the board's own interface.
searches: []

# The collections come last on purpose: a comment sitting above one belongs, in YAML, to
# the key before it, and an empty collection that later fills up can take that comment with
# it. Scalars first keeps every note below attached to what it is describing.
candidate:
  name: ""
  email:
  phone:
  # false: send applications without a cover letter, and write none.
  cover_letter: true
  # Steers the cover letter's wording. Not a fact, and grants nothing.
  cover_letter_notes:
  # Steers how questions get answered — which option to take where two fit, how to phrase a
  # number. Also not a fact: an answer still has to point at one.
  answer_notes:
  # Which resume goes with an application: `select:` names one already on your board
  # profile, `upload:` sends a file. The setup run fills this in from what it finds.
  resume: {}
  # Employer questions are answered from these facts and from nothing else. A question
  # these do not answer stops the run and asks you, rather than guessing at it.
  facts: {}

# How much of a run happens without you.
run:
  auto_pick: true        # false: every posting that fits waits for you to pick it
  apply_mode: auto       # auto: the board submits quick-apply forms itself | manual: you do,
                         # in your own browser with the extension. Link-outs are always manual.
  answers: missing       # never | missing | always — when to stop and ask about an answer
  board_modes: {}        # per-board apply_mode, e.g. {jobstreet: manual}

# What counts as a fit. Verdict and score are computed in code by the rag pipeline:
# weak < partial < promising < strong.
policy:
  min_verdict: promising
  min_score: 60
  allow_missing_essentials: 1
  max_applications: 10   # submitted per run
  max_assessments: 30    # assessed per run; each is several model calls
  delay_seconds: [20.0, 60.0]
  skip_titles: []
  skip_companies: []

# Who reads and writes. `web` drives a chat site you are signed in to — no key, nothing
# billed. Anything else is an API provider, with its key read from the named variable.
llm:
  provider: web
  site: gemini           # gemini | claude | chatgpt
  browser: camoufox
  headless: true
  model:
  api_key_env:

# Retrieval runs against your portfolio's index through its API, under a pfl_ token.
portfolio:
  api: https://api.blograg.pbh-dev.tech   # where retrieval asks; a local one works too
  token_env: APPLIER_PORTFOLIO_TOKEN

# The job board's browser, for searching, reading postings and auto-applying. Hidden: a
# window only comes up when you are needed (a sign-in, a bot check). It reopens if closed.
browser:
  headless: true
  capture_steps: false   # save every apply step's page, not only the ones that failed

boards:
  jobstreet:
    region: sg

state_dir: .applier
setup_done: false
"""


def _round_trip() -> YAML:
    """ruamel, set up to give back what it was given: comments, order, and block style."""
    yaml_io = YAML()
    yaml_io.preserve_quotes = True
    yaml_io.width = 100
    yaml_io.indent(mapping=2, sequence=4, offset=2)
    return yaml_io


def parse(text: str, *, where: str = "the config") -> Config:
    """Validates config text without writing anything. What the raw editor's Save runs first."""
    try:
        raw = yaml.safe_load(text) or {}
    except yaml.YAMLError as error:
        raise ConfigError(f"{where} is not valid YAML:\n{error}") from error

    if not isinstance(raw, dict):
        raise ConfigError(f"{where} should be a mapping of settings, not {type(raw).__name__}.")

    try:
        return Config.model_validate(raw)
    except ValidationError as error:
        raise ConfigError(f"{where} would not load:\n{_explain(error)}") from error


def _explain(error: ValidationError) -> str:
    """Pydantic's report as lines a person can act on: where, and what is wrong."""
    lines = []
    for problem in error.errors():
        where = ".".join(str(part) for part in problem["loc"]) or "(top level)"
        lines.append(f"  {where}: {problem['msg']}")
    return "\n".join(lines)


def load(path: Path) -> Config:
    if not path.is_file():
        raise ConfigError(
            f"No config at {path}. Run `applier serve` and it will write one, or copy "
            f"applier.example.yaml to {path.name}."
        )

    config = parse(path.read_text(encoding="utf-8"), where=str(path))
    return _resolve(config, path)


def load_or_create(path: Path) -> Config:
    """The config, written as a skeleton first if there is none.

    Starting the controller must never be blocked on a file the setup run exists to write.
    """
    if not path.is_file():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(_SKELETON, encoding="utf-8")

    return load(path)


def _resolve(config: Config, path: Path) -> Config:
    # Relative paths in the file mean relative to the file, not to wherever it was run from.
    base = path.resolve().parent
    config.source_path = path.resolve()

    config.written_paths["state_dir"] = str(config.state_dir)
    if not config.state_dir.is_absolute():
        config.state_dir = base / config.state_dir

    if upload := config.candidate.resume.upload:
        config.written_paths["resume"] = str(upload)
        if not upload.expanduser().is_absolute():
            config.candidate.resume.upload = base / upload

    return config


def save(config: Config, path: Path | None = None) -> Path:
    """Writes the config back, keeping everything about the file that is not data.

    The file on disk is re-read as a round-trip document and the changed values are laid into
    it, rather than the document being dumped afresh from the model. That is the difference
    between a config you can keep hand-editing and one the tool has taken over: comments,
    key order, block style and anything this version does not know about all survive.

    The write is atomic — a temporary file beside the real one, then a rename — so a crash
    mid-save cannot leave you with half a config and no way to start.
    """
    target = path or config.source_path
    if target is None:
        raise ConfigError("This config was not read from a file, so there is nowhere to save it.")

    yaml_io = _round_trip()
    try:
        document = yaml_io.load(target.read_text(encoding="utf-8")) if target.is_file() else None
    except YAMLError:
        # A file we cannot round-trip is one we cannot preserve; a fresh document at least
        # keeps the settings. The page has already validated what is being written.
        document = None

    if not isinstance(document, dict):
        document = {}

    values = config.model_dump(mode="json", exclude_none=True)
    if written := config.written_paths.get("state_dir"):
        values["state_dir"] = written
    if written := config.written_paths.get("resume"):
        values.setdefault("candidate", {}).setdefault("resume", {})["upload"] = written

    _lay_into(document, values)

    buffer = io.StringIO()
    yaml_io.dump(document, buffer)

    temporary = target.with_name(target.name + ".tmp")
    temporary.write_text(buffer.getvalue(), encoding="utf-8")
    temporary.replace(target)
    config.source_path = target.resolve()

    return target


def _quoted(value: Any) -> Any:
    """A string that YAML would read back as something else, written so it cannot be.

    This matters more than it sounds. "Do you have a driving licence?" is answered "No", and
    YAML reads a bare ``No`` as a boolean — so the fact would come back as ``False`` and the
    config would refuse to load at all. Salaries are worse: ``7000`` returns as an integer and
    gets filled into a text field as one. Anything whose own spelling does not survive a round
    trip is quoted.
    """
    if not isinstance(value, str):
        return value

    try:
        parsed = yaml.safe_load(value)
    except yaml.YAMLError:
        return DoubleQuotedScalarString(value)

    return value if isinstance(parsed, str) else DoubleQuotedScalarString(value)


def _lay_into(document: Any, values: Any) -> None:
    """Writes ``values`` into ``document`` in place, keeping the document's own nodes.

    Assigning a whole mapping would replace ruamel's commented node with a plain dict and
    lose everything attached to it, so mappings are walked and only leaves are set.

    Keys the values no longer carry are removed — a fact deleted on the page has to leave the
    file — with one exception: a key whose value in the file is empty is a placeholder, and
    its explanatory comment is attached to it. Dropping `cover_letter_notes:` because nothing
    has been written there yet would take the two lines explaining what it is with it.
    """
    for key, value in values.items():
        if isinstance(value, dict) and isinstance(document.get(key), dict):
            _lay_into(document[key], value)
        elif isinstance(value, list):
            document[key] = [_quoted(item) for item in value]
        else:
            document[key] = _quoted(value)

    for gone in [name for name in document if name not in values and document[name] is not None]:
        del document[gone]
