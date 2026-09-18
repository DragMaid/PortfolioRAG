"""A cover letter for a posting, written from the author's own portfolio.

Three stages, borrowed from the analysis:

    1. extract      (LLM)   posting -> requirements, each with a search written for it
    2. retrieve     (code)  requirements -> passages, hybrid + fused + diversified
    3. write        (LLM)   passages + requirements -> the letter, citing what it used

The citations are checked the same way the analysis checks its own: an id that was never
shown is dropped, so the source list under the letter only ever names real passages.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

from . import prompts
from .pipeline import (
    JobFitOutcome,
    JobFitPipeline,
    JobFitRequest,
    OutputCallback,
    PipelineError,
    StageCallback,
    retrieved,
)
from .retrieval import Retriever
from .schemas import CoverLetter, build_cover_letter, source_name

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class CoverLetterRequest:
    job_description: str
    notes: str | None = None


class CoverLetterPipeline(JobFitPipeline):
    """Shares the analysis' models, extraction, retrieval settings and cost accounting."""

    def write(
        self,
        retriever: Retriever,
        request: CoverLetterRequest,
        on_stage: StageCallback | None = None,
        on_output: OutputCallback | None = None,
    ) -> JobFitOutcome:
        """Runs the three stages; the callbacks are as for :meth:`JobFitPipeline.run`."""
        stage = on_stage or (lambda _: None)
        output = on_output or (lambda _stage, _data: None)
        started = time.monotonic()

        # The role and company come from here too; see PostingAnalysis.
        stage("extract")
        analysis = self._extract(JobFitRequest(job_description=request.job_description))
        output("extract", analysis.model_dump(mode="json"))

        if not analysis.requirements:
            raise PipelineError(
                "No requirements could be read out of that posting. Paste the requirements "
                "and responsibilities rather than the company description."
            )

        queries = [requirement.search_query for requirement in analysis.requirements]

        stage("retrieve")
        passages = retriever.search(queries)
        output("retrieve", retrieved(retriever, queries, passages))

        if not passages:
            raise PipelineError(
                "Nothing is indexed for this portfolio yet, so there is nothing to write the "
                "letter from."
            )

        stage("write")
        chain = prompts.COVER_LETTER_PROMPT | self.provider.structured(self._reasoner, CoverLetter)

        result: CoverLetter = self._invoke(
            chain,
            {
                "author_name": retriever.author_name,
                "role_title": analysis.role_title,
                "seniority": analysis.seniority,
                "company_line": f"Company: {analysis.company}\n" if analysis.company else "",
                "notes_block": f"\nAuthor's notes:\n{request.notes}\n" if request.notes else "",
                "requirement_list": prompts.render_requirements(analysis.requirements),
                "passages": prompts.render_passages(passages),
            },
            CoverLetter,
            stage="write",
        )

        output("write", result.model_dump(mode="json"))

        letter = result.letter.strip()
        if not letter:
            raise PipelineError("The write step returned an empty letter.")

        by_id = {passage.document_id: passage for passage in passages}
        cited = [by_id[i] for i in dict.fromkeys(result.cited_document_ids) if i in by_id]
        rejected = len(set(result.cited_document_ids)) - len(cited)

        duration_ms = int((time.monotonic() - started) * 1000)

        logger.info(
            "Cover letter written.",
            extra={
                "passages": len(passages),
                "cited": len(cited),
                "rejected": rejected,
                "duration_ms": duration_ms,
            },
        )

        report = build_cover_letter(
            letter=letter,
            role_title=analysis.role_title,
            company=analysis.company,
            sources=[
                {
                    "document_id": passage.document_id,
                    "source_type": source_name(passage.source_type),
                    "source_label": passage.source_label,
                }
                for passage in cited
            ],
            provider=self.provider.name,
            model=self.model_name,
            input_tokens=self.usage.input_tokens,
            output_tokens=self.usage.output_tokens,
            cost_usd=self.usage.cost_usd,
            duration_ms=duration_ms,
        )

        return JobFitOutcome(report=report, usage=self.usage)
