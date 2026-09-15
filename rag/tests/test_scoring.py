"""Scoring: the number has to mean the same thing every time it is produced."""

from __future__ import annotations

from rag.schemas import VerifiedFinding
from rag.scoring import score, summarize, verdict


def finding(status: str, essential: bool = True, requirement: str = "r") -> VerifiedFinding:
    return VerifiedFinding(
        requirement=requirement,
        is_essential=essential,
        status=status,
        confidence=0.9,
        rationale="",
        evidence=[],
    )


def test_everything_met_is_a_hundred():
    assert score([finding("met") for _ in range(5)]) == 100


def test_nothing_met_is_zero():
    assert score([finding("missing") for _ in range(5)]) == 0


def test_partial_is_worth_half():
    assert score([finding("partial"), finding("partial")]) == 50


def test_nice_to_haves_count_less_than_essentials():
    essential_met = score([finding("met"), finding("missing", essential=False)])
    optional_met = score([finding("missing"), finding("met", essential=False)])

    assert essential_met > optional_met


def test_empty_findings_score_zero_rather_than_dividing_by_zero():
    assert score([]) == 0


def test_scoring_is_deterministic():
    findings = [finding("met"), finding("partial"), finding("missing", essential=False)]

    assert len({score(findings) for _ in range(20)}) == 1


def test_a_demotion_always_lowers_the_score():
    """The property a model-produced score does not have, and the reason this is computed."""
    met = [finding("met"), finding("met"), finding("met")]
    demoted = [finding("met"), finding("met"), finding("missing")]

    assert score(demoted) < score(met)


def test_unmet_essentials_cannot_be_called_strong():
    """A pile of satisfied bonuses must not carry a posting whose real requirement is unmet."""
    findings = [finding("missing")] + [finding("met", essential=False) for _ in range(12)]
    value = score(findings)

    assert verdict(findings, value) != "strong"


def test_all_essentials_met_can_be_strong():
    findings = [finding("met") for _ in range(4)]

    assert verdict(findings, score(findings)) == "strong"


def test_verdict_bands_are_ordered():
    bands = [
        ([finding("missing")] * 4, "weak"),
        ([finding("partial")] * 4, "partial"),
    ]

    for findings, expected in bands:
        assert verdict(findings, score(findings)) == expected


def test_summarize_counts_essentials_separately():
    counts = summarize(
        [finding("met"), finding("missing"), finding("met", essential=False)]
    )

    assert counts["met"] == 2
    assert counts["missing"] == 1
    assert counts["essential"] == 2
    assert counts["essential_met"] == 1
