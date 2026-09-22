"""The fit and the letter: rag's own pipelines, run the way ``rag-local`` runs them.

Passages come from the portfolio API under the author's token; every model call goes
through :class:`~applier.llm.Llm`. Nothing here decides anything — the report's verdict and
score are computed in code by rag, and the policy compares them against thresholds in
``config``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from rag.cover_letter import CoverLetterRequest
from rag.local.api import ApiError, ApiRetriever, PortfolioApi
from rag.pipeline import JobFitRequest, PipelineError

from .errors import ApplierError
from .llm import Llm


class AssessmentError(ApplierError):
    """The analysis or the letter could not be produced. Retried next run."""


class PortfolioUnavailableError(AssessmentError):
    """The portfolio API or its worker is not there. Every posting would fail the same way."""

    fatal = True


@dataclass(slots=True)
class Fit:
    report: dict[str, Any]

    @property
    def verdict(self) -> str:
        return self.report.get("verdict", "weak")

    @property
    def score(self) -> int:
        return int(self.report.get("score", 0))

    @property
    def missing_essentials(self) -> int:
        return sum(
            1
            for requirement in self.report.get("requirements", [])
            if requirement.get("is_essential") and requirement.get("status") == "missing"
        )

    def line(self) -> str:
        return f"{self.verdict} ({self.score}) — {self.report.get('headline', '')}".strip(" —")


class Assessor:
    def __init__(self, llm: Llm, *, api: str, token: str = "", log=print):
        self.llm = llm
        self.retriever = ApiRetriever(PortfolioApi(api, token))
        self.log = log

    @property
    def token(self) -> str:
        return self.retriever.api.token

    @token.setter
    def token(self, value: str) -> None:
        """Swapped in while the session runs, because the page can supply one at any point.

        A controller starts without a token — pasting it is a box on the page, not a reason
        to refuse to start — so the first assessment may well be the first time there is one.
        """
        self.retriever.api.token = value.strip()

    def fit(self, posting_text: str) -> Fit:
        def run() -> dict[str, Any]:
            pipeline = self.llm.job_fit()
            return pipeline.run(
                self.retriever,
                JobFitRequest(job_description=posting_text),
                on_stage=lambda stage: self.log(f"  fit: {stage}"),
            ).report

        return Fit(self._guarded(run))

    def letter(self, posting_text: str, notes: str | None) -> str:
        def run() -> str:
            pipeline = self.llm.cover_letter()
            report = pipeline.write(
                self.retriever,
                CoverLetterRequest(job_description=posting_text, notes=notes),
                on_stage=lambda stage: self.log(f"  letter: {stage}"),
            ).report
            return report["letter"].strip()

        return _plain(self._guarded(run))

    def _guarded[T](self, run) -> T:
        try:
            return self.llm.call(run)
        except ApiError as error:
            raise PortfolioUnavailableError(str(error)) from error
        except PipelineError as error:
            raise AssessmentError(str(error)) from error


def _plain(markdown: str) -> str:
    """The letter as a plain-text box shows it: Markdown emphasis and headings dropped."""
    import re

    text = re.sub(r"^#+\s*", "", markdown, flags=re.MULTILINE)
    text = re.sub(r"(\*\*|__)(.+?)\1", r"\2", text)
    text = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"\1", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()
