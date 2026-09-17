"""The shapes that cross a boundary.

Three groups, and the distinction between them is load-bearing:

* **Model-facing** (``PostingAnalysis``, ``Assessment``, ``Narrative``) — what the provider
  is asked to return. Kept deliberately plain: every field required, no defaults, no numeric
  bounds, no nesting deeper than it needs. A strict JSON schema is a contract the model has
  to satisfy on every call, and the more elaborate it is the more often it will not.
* **Verified** (``VerifiedFinding``) — what survived citation checking. Produced by this
  code, never by a model.
* **Wire** (``build_report``) — what goes back in ``RagJobs.ResultJson`` for the API to
  deserialise into ``JobFitReportDto``. snake_case, because that is the one naming
  convention Python and .NET can both hold without either writing the other's.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field

from rag.corpus import SourceType

# ---------------------------------------------------------------------------
# Model-facing
# ---------------------------------------------------------------------------

RequirementCategory = Literal["skill", "experience", "domain", "education", "logistics", "other"]

RequirementStatus = Literal["met", "partial", "missing"]

Verdict = Literal["weak", "partial", "promising", "strong"]


class ExtractedRequirement(BaseModel):
    """One thing the posting asks for."""

    requirement: str = Field(description="The requirement in one line, as the posting states it.")

    is_essential: bool = Field(
        description=(
            "True when the posting treats this as a bar rather than a bonus. Language like "
            "'required', 'must have', or a plain statement of the role's substance is "
            "essential; 'nice to have', 'a plus', 'bonus' is not."
        )
    )

    category: RequirementCategory = Field(description="What kind of requirement this is.")

    search_query: str = Field(
        description=(
            "A search that would find evidence of this in someone's portfolio. Write what "
            "the evidence would look like, not what the posting said: for 'experience with "
            "high-throughput data pipelines', search 'built streaming data pipeline "
            "throughput latency', not the requirement verbatim."
        )
    )


class PostingAnalysis(BaseModel):
    """What the posting is asking for, read out of it."""

    role_title: str = Field(
        description=(
            "The job title as the posting states it, without the company, location or "
            "employment type. Infer it from the responsibilities if there is no title line."
        )
    )

    # Required but nullable rather than defaulted: strict structured-output modes need every
    # field listed, and null is the honest answer for a posting that names no employer.
    company: str | None = Field(
        description=(
            "The hiring company's name, as the posting gives it. Null when the posting does "
            "not name one — do not guess from a product or a recruiter agency's name."
        )
    )

    seniority: Literal["junior", "mid", "senior", "staff", "principal", "unclear"] = Field(
        description="The level the posting is pitched at."
    )

    requirements: list[ExtractedRequirement] = Field(
        description=(
            "Every distinct requirement, in the order the posting raises them. Merge "
            "restatements of the same thing; do not invent requirements the posting does "
            "not make; do not include company boilerplate, benefits or legal notices."
        )
    )


class EvidenceRef(BaseModel):
    """A passage a finding rests on."""

    document_id: int = Field(
        description="The number in the [#N] label of the passage. Only passages you were shown."
    )

    quote: str = Field(
        description=(
            "The words from that passage that support this finding, copied exactly. One or "
            "two sentences. Do not paraphrase, correct or join text from different passages."
        )
    )


class RequirementFinding(BaseModel):
    """Whether one requirement is answered by the portfolio."""

    requirement: str = Field(description="The requirement, repeated verbatim from the list given.")

    status: RequirementStatus = Field(
        description=(
            "'met' when a passage shows the person has done this; 'partial' when the "
            "evidence is adjacent but not the thing asked for; 'missing' when the passages "
            "do not show it. Absence of evidence is 'missing' — you are reading a portfolio, "
            "not a complete history, and you must not infer from what a strong candidate "
            "probably also knows."
        )
    )

    confidence: float = Field(
        description="0 to 1. How certain the cited passages make this, not how likely it is."
    )

    rationale: str = Field(description="One sentence. What the evidence shows, or what is absent.")

    evidence: list[EvidenceRef] = Field(
        description=(
            "The passages this rests on. Required for 'met' and 'partial'; empty for "
            "'missing', which by definition has none."
        )
    )


class Assessment(BaseModel):
    """The per-requirement pass over the retrieved passages."""

    findings: list[RequirementFinding] = Field(
        description="One finding per requirement given, in the same order. Omit none."
    )


class Narrative(BaseModel):
    """The prose, written after the findings have been verified."""

    headline: str = Field(description="One line, under 120 characters. What a reader takes away.")

    summary: str = Field(
        description=(
            "Two short paragraphs of Markdown. Honest about the gaps: a summary that reads "
            "as a pitch is worth nothing to either side."
        )
    )

    strengths: list[str] = Field(description="Up to four. Each tied to a met requirement.")

    gaps: list[str] = Field(
        description="Up to four. What the posting asks for that the portfolio does not show."
    )

    talking_points: list[str] = Field(
        description="Up to four questions or topics worth raising in a first conversation."
    )


# ---------------------------------------------------------------------------
# Cover letter
# ---------------------------------------------------------------------------


class CoverLetter(BaseModel):
    """The letter, and the passages it was written from."""

    letter: str = Field(
        description=(
            "The letter itself, as Markdown paragraphs. No subject line, no address block, "
            "no bracketed placeholders — the author sends this as written."
        )
    )

    cited_document_ids: list[int] = Field(
        description=(
            "The numbers in the [#N] labels of every passage the letter draws on. Only "
            "passages you were shown; ids that were not are dropped."
        )
    )


def build_cover_letter(
    *,
    letter: str,
    role_title: str,
    company: str | None,
    sources: list[dict[str, Any]],
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    cost_usd: Decimal,
    duration_ms: int,
) -> dict[str, Any]:
    """The JSON the API reads back as a ``CoverLetterDto``."""
    return {
        "letter": letter,
        "role_title": role_title,
        "company": company,
        "sources": sources,
        "usage": {
            "provider": provider,
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": str(cost_usd),
            "duration_ms": duration_ms,
        },
    }


# ---------------------------------------------------------------------------
# Verified
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class VerifiedEvidence:
    """A citation that resolved to a real passage and a quote that is really in it."""

    document_id: int
    source_type: SourceType
    source_label: str
    quote: str


@dataclass(slots=True)
class VerifiedFinding:
    """A finding after citation checking, which may have demoted it."""

    requirement: str
    is_essential: bool
    status: RequirementStatus
    confidence: float
    rationale: str
    evidence: list[VerifiedEvidence] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Wire
# ---------------------------------------------------------------------------

_SOURCE_NAMES = {
    SourceType.PROFILE: "profile",
    SourceType.EXPERIENCE: "experience",
    SourceType.POST: "post",
}


def build_report(
    *,
    role_title: str,
    company: str | None,
    verdict: Verdict,
    score: int,
    narrative: Narrative,
    findings: list[VerifiedFinding],
    queries: list[str],
    passages_considered: int,
    passages_cited: int,
    citations_rejected: int,
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    cost_usd: Decimal,
    duration_ms: int,
) -> dict[str, Any]:
    """The JSON the API reads back as a ``JobFitReportDto``."""
    return {
        "role_title": role_title,
        "company": company,
        "verdict": verdict,
        "score": score,
        "headline": narrative.headline,
        "summary": narrative.summary,
        "requirements": [
            {
                "requirement": finding.requirement,
                "is_essential": finding.is_essential,
                "status": finding.status,
                "confidence": round(finding.confidence, 3),
                "rationale": finding.rationale,
                "evidence": [
                    {
                        "document_id": evidence.document_id,
                        "source_type": _SOURCE_NAMES.get(evidence.source_type, "post"),
                        "source_label": evidence.source_label,
                        "quote": evidence.quote,
                    }
                    for evidence in finding.evidence
                ],
            }
            for finding in findings
        ],
        "strengths": narrative.strengths,
        "gaps": narrative.gaps,
        "talking_points": narrative.talking_points,
        "retrieval": {
            "queries": queries,
            "passages_considered": passages_considered,
            "passages_cited": passages_cited,
            "citations_rejected": citations_rejected,
        },
        "usage": {
            "provider": provider,
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            # A string, not a float: the API deserialises this into a C# decimal, and a
            # float would round a fraction of a cent into a slightly wrong bill.
            "cost_usd": str(cost_usd),
            "duration_ms": duration_ms,
        },
    }


def source_name(source_type: SourceType) -> str:
    return _SOURCE_NAMES.get(source_type, "post")
