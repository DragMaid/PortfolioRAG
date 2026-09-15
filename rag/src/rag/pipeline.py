"""The analysis: a posting in, a grounded report out.

Six stages, three of which are model calls and three of which are code. The split is the
design, not an implementation detail — every judgement a model makes is checked or replaced
by something deterministic before it reaches a reader.

    1. extract      (LLM)   posting -> requirements, each with a search written for it
    2. retrieve     (code)  requirements -> passages, hybrid + fused + diversified
    3. assess       (LLM)   passages -> a status and a citation per requirement
    4. verify       (code)  citations -> only what the passages support; the rest demoted
    5. score        (code)  verified findings -> a number that means the same thing twice
    6. narrate      (LLM)   verified findings -> prose that cannot outrun its evidence

Stage 1 is the one that makes the retrieval work. A job posting is two thousand words of
mixed requirements, benefits and boilerplate; embedding it whole produces a vector that
points at the average of all of it and retrieves the portfolio's most generically impressive
passages. Splitting it into requirements and searching for each separately is what lets the
tenth requirement be found at all.

Stage 6 never sees the passages — only the findings that survived stage 4 — so the prose
physically cannot reintroduce a claim the evidence did not support.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from langchain_core.messages import AIMessage
from psycopg import Connection

from . import citations, prompts, retrieval, scoring
from .embeddings import Embedder
from .providers import ChatProvider
from .queue import Usage
from .schemas import (
    Assessment,
    ExtractedRequirement,
    Narrative,
    PostingAnalysis,
    build_report,
)
from .settings import Settings

logger = logging.getLogger(__name__)


class PipelineError(RuntimeError):
    """The analysis could not be produced. The message reaches the reader."""


@dataclass(slots=True)
class JobFitRequest:
    job_description: str
    role_title: str | None = None
    company: str | None = None


@dataclass(slots=True)
class JobFitOutcome:
    report: dict[str, Any]
    usage: Usage


class JobFitPipeline:
    """One analysis, against one author's index, on one author's credential."""

    def __init__(
        self,
        *,
        settings: Settings,
        provider: ChatProvider,
        embedder: Embedder,
        api_key: str,
        model: str,
    ):
        self.settings = settings
        self.provider = provider
        self.embedder = embedder
        self.model_name = model

        # Two models used for requirement extraction, and reasoning for job fit
        # Each use a different effort config and potentially a different model
        # to optmize token usage.
        self._extractor = provider.build(
            api_key=api_key,
            model=model,
            max_tokens=settings.max_tokens,
            effort=settings.extraction_effort,
            timeout=settings.request_timeout_seconds,
            max_retries=settings.max_retries,
            seed=settings.llm_seed,
        )

        self._reasoner = provider.build(
            api_key=api_key,
            model=model,
            max_tokens=settings.max_tokens,
            effort=settings.assessment_effort,
            timeout=settings.request_timeout_seconds,
            max_retries=settings.max_retries,
            seed=settings.llm_seed,
        )

        self._usage = Usage()

    def run(
        self,
        conn: Connection,
        author_id: int,
        request: JobFitRequest,
        on_stage: Callable[[str], None] | None = None,
    ) -> JobFitOutcome:
        """Runs the six stages. ``on_stage`` is told each stage's name as it starts, for a
        caller that wants to show progress; the worker passes nothing."""
        stage = on_stage or (lambda _name: None)
        started = time.monotonic()

        stage("extract")
        analysis = self._extract(request)

        if not analysis.requirements:
            raise PipelineError(
                "No requirements could be read out of that posting. Paste the requirements "
                "and responsibilities rather than the company description."
            )

        queries = [requirement.search_query for requirement in analysis.requirements]

        stage("retrieve")
        passages = retrieval.retrieve(
            conn,
            self.embedder,
            author_id,
            queries,
            dense_k=self.settings.dense_k,
            sparse_k=self.settings.sparse_k,
            rrf_k=self.settings.rrf_k,
            limit=self.settings.context_passages,
            diversity_lambda=self.settings.mmr_lambda,
        )

        if not passages:
            raise PipelineError(
                "Nothing is indexed for this portfolio yet, so there is nothing to compare "
                "the posting against."
            )

        stage("assess")
        assessment = self._assess(analysis, passages)

        essential = {
            requirement.requirement: requirement.is_essential
            for requirement in analysis.requirements
        }

        stage("verify")
        verification = citations.verify(assessment.findings, passages, essential)

        value = scoring.score(verification.findings)
        verdict = scoring.verdict(verification.findings, value)
        counts = scoring.summarize(verification.findings)

        stage("narrate")
        narrative = self._narrate(analysis, verification.findings, value, verdict, counts)

        duration_ms = int((time.monotonic() - started) * 1000)

        logger.info(
            "Analysis complete.",
            extra={
                "author_id": author_id,
                "requirements": len(analysis.requirements),
                "passages": len(passages),
                "cited": len(verification.cited_document_ids),
                "rejected": verification.rejected,
                "score": value,
                "verdict": verdict,
                "input_tokens": self._usage.input_tokens,
                "output_tokens": self._usage.output_tokens,
                "cost_usd": str(self._usage.cost_usd),
                "duration_ms": duration_ms,
            },
        )

        report = build_report(
            verdict=verdict,
            score=value,
            narrative=narrative,
            findings=verification.findings,
            queries=queries,
            passages_considered=len(passages),
            passages_cited=len(verification.cited_document_ids),
            citations_rejected=verification.rejected,
            provider=self.provider.name,
            model=self.model_name,
            input_tokens=self._usage.input_tokens,
            output_tokens=self._usage.output_tokens,
            cost_usd=self._usage.cost_usd,
            duration_ms=duration_ms,
        )

        return JobFitOutcome(report=report, usage=self._usage)

    @property
    def usage(self) -> Usage:
        """What has been spent so far — read by the worker even when a stage raised."""
        return self._usage

    def _extract(self, request: JobFitRequest) -> PostingAnalysis:
        chain = prompts.EXTRACT_PROMPT | self.provider.structured(self._extractor, PostingAnalysis)

        return self._invoke(
            chain,
            {
                "job_description": request.job_description,
                # Rendered as whole lines so an absent title leaves no dangling label. The
                # posting usually carries both, and these are only for when it does not.
                "role_line": f"Role: {request.role_title}\n" if request.role_title else "",
                "company_line": f"Company: {request.company}\n" if request.company else "",
            },
            PostingAnalysis,
            stage="extract",
        )

    def _assess(self, analysis: PostingAnalysis, passages: list[retrieval.Passage]) -> Assessment:
        chain = prompts.ASSESS_PROMPT | self.provider.structured(self._reasoner, Assessment)

        return self._invoke(
            chain,
            {
                "role_title": analysis.role_title,
                "seniority": analysis.seniority,
                "requirement_list": prompts.render_requirements(analysis.requirements),
                "passages": prompts.render_passages(passages),
            },
            Assessment,
            stage="assess",
        )

    def _narrate(
        self,
        analysis: PostingAnalysis,
        findings: list,
        value: int,
        verdict: str,
        counts: dict[str, int],
    ) -> Narrative:
        chain = prompts.NARRATE_PROMPT | self.provider.structured(self._reasoner, Narrative)

        return self._invoke(
            chain,
            {
                "role_title": analysis.role_title,
                "seniority": analysis.seniority,
                "score": value,
                "verdict": verdict,
                "met": counts.get("met", 0),
                "partial": counts.get("partial", 0),
                "missing": counts.get("missing", 0),
                "essential": counts.get("essential", 0),
                "essential_met": counts.get("essential_met", 0),
                "findings": prompts.render_findings(findings),
            },
            Narrative,
            stage="narrate",
        )

    def _invoke(self, chain, inputs: dict[str, Any], schema: type, stage: str):
        """Runs one stage, records what it cost, and turns its failures into ours.

        Every model call goes through here so that token accounting cannot be forgotten at a
        call site — the budget depends on it, and a stage that spent tokens and then raised
        has still spent them.
        """
        started = time.monotonic()

        try:
            result = chain.invoke(inputs)
        except Exception as error:
            logger.exception("A pipeline stage failed.", extra={"stage": stage})
            raise PipelineError(f"The {stage} step failed: {error}") from error

        # NOTE: `include_raw=True` gives {"raw", "parsed", "parsing_error"}. The raw message is
        # where the usage lives, so it is read before anything else can raise.
        raw = result.get("raw") if isinstance(result, dict) else None

        if isinstance(raw, AIMessage):
            self._record(raw)

        parsed = result.get("parsed") if isinstance(result, dict) else result

        if parsed is None:
            error = result.get("parsing_error") if isinstance(result, dict) else None
            raise PipelineError(
                f"The {stage} step returned something that did not match the expected "
                f"shape ({error})."
            )

        # NOTE: the schema checking here is via type as we've already passed the schema
        # structure into the LLM invoke call
        if not isinstance(parsed, schema):
            raise PipelineError(f"The {stage} step returned a {type(parsed).__name__}.")

        logger.info(
            "Stage finished.",
            extra={"stage": stage, "duration_ms": int((time.monotonic() - started) * 1000)},
        )

        return parsed

    def _record(self, message: AIMessage) -> None:
        """Adds one call's tokens and cost to the running total."""
        usage = message.usage_metadata or {}

        input_tokens = int(usage.get("input_tokens", 0) or 0)
        output_tokens = int(usage.get("output_tokens", 0) or 0)

        price = self.provider.price(self.model_name)
        cost = price.cost(input_tokens, output_tokens) if price else Decimal("0")

        self._usage = self._usage + Usage(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost,
        )


def requirement_queries(requirements: list[ExtractedRequirement]) -> list[str]:
    """The searches a set of requirements implies. Used by the eval harness."""
    return [requirement.search_query for requirement in requirements]
