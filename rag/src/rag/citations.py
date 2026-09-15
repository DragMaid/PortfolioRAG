"""Checking that the model only said what the passages support.

1. The passage must exist and have been shown. A `document_id` outside the retrieved
   is considered bullshit.
2. The quote must really be in it. Exact match after whitespace and punctuation are
   normalised.
3. A claim with no surviving evidence is demoted to "missing" rather than dropped.
"""

from __future__ import annotations

import logging
import re
import unicodedata
from dataclasses import dataclass

from .retrieval import Passage
from .schemas import RequirementFinding, VerifiedEvidence, VerifiedFinding

logger = logging.getLogger(__name__)

_OVERLAP_THRESHOLD = 0.8
_MIN_QUOTE_WORDS = 4
_WORD = re.compile(r"[a-z0-9+#.]+")


@dataclass(frozen=True, slots=True)
class VerificationResult:
    findings: list[VerifiedFinding]
    rejected: int
    cited_document_ids: set[int]


def verify(
    findings: list[RequirementFinding],
    passages: list[Passage],
    essential_by_requirement: dict[str, bool],
) -> VerificationResult:
    """Filters findings down to what the passages actually support."""
    by_id = {passage.document_id: passage for passage in passages}

    verified: list[VerifiedFinding] = []
    rejected = 0
    cited: set[int] = set()

    for finding in findings:
        evidence: list[VerifiedEvidence] = []

        for reference in finding.evidence:
            passage = by_id.get(reference.document_id)

            if passage is None:
                rejected += 1
                logger.warning(
                    "Dropped a citation to a passage that was never shown.",
                    extra={"document_id": reference.document_id},
                )
                continue

            if not quote_is_supported(reference.quote, passage.content):
                rejected += 1
                logger.warning(
                    "Dropped a quote that is not in the passage it cites.",
                    extra={"document_id": reference.document_id, "quote": reference.quote[:120]},
                )
                continue

            evidence.append(
                VerifiedEvidence(
                    document_id=passage.document_id,
                    source_type=passage.source_type,
                    source_label=passage.source_label,
                    quote=reference.quote.strip(),
                )
            )
            cited.add(passage.document_id)

        status = finding.status
        rationale = finding.rationale
        # Confidence score, on scale of 0.0 to 1.0
        confidence = min(1.0, max(0.0, finding.confidence))

        # TODO: consider changing this to an enum instead
        if status in ("met", "partial") and not evidence:
            status = "missing"
            confidence = min(confidence, 0.3)
            rationale = (
                "The portfolio does not show this. (An earlier reading cited passages that "
                "could not be verified, so the claim was withdrawn.)"
            )

        verified.append(
            VerifiedFinding(
                requirement=finding.requirement,
                is_essential=essential_by_requirement.get(finding.requirement, True),
                status=status,
                confidence=confidence,
                rationale=rationale,
                evidence=evidence,
            )
        )

    if rejected:
        logger.warning("Citations rejected.", extra={"count": rejected})

    return VerificationResult(findings=verified, rejected=rejected, cited_document_ids=cited)


def quote_is_supported(quote: str, passage: str) -> bool:
    """Whether a quote is really in a passage."""
    normalized_quote = _normalize(quote)
    normalized_passage = _normalize(passage)

    if not normalized_quote:
        return False

    # Literal exact check 
    if normalized_quote in normalized_passage:
        return True

    quote_words = _WORD.findall(normalized_quote)

    # Too little keyword occurence
    if len(quote_words) < _MIN_QUOTE_WORDS:
        return False

    # Not enough word relativel occurence
    passage_words = set(_WORD.findall(normalized_passage))
    present = sum(1 for word in quote_words if word in passage_words)

    return present / len(quote_words) >= _OVERLAP_THRESHOLD


def _normalize(text: str) -> str:
    """Normalize paragraph text to unicode compatible variants."""
    text = unicodedata.normalize("NFKC", text)
    return " ".join(text.casefold().split())
