"""Citation verification — the thing standing between a fluent guess and a public claim."""

from __future__ import annotations

from rag.citations import quote_is_supported, verify
from rag.retrieval import Passage
from rag.schemas import EvidenceRef, RequirementFinding


def passage(document_id: int, content: str, label: str = "Vector Core") -> Passage:
    return Passage(
        document_id=document_id,
        source_type=2,
        source_label=label,
        chunk_index=0,
        content=content,
    )


def finding(status: str, evidence: list[EvidenceRef], requirement: str = "Rust in production"):
    return RequirementFinding(
        requirement=requirement,
        status=status,
        confidence=0.9,
        rationale="Because the passage says so.",
        evidence=evidence,
    )


def test_exact_quote_is_accepted():
    assert quote_is_supported("rewrote the log in Rust", "We rewrote the log in Rust last year.")


def test_whitespace_and_case_do_not_matter():
    assert quote_is_supported("REWROTE  the\nlog", "We rewrote the log in Rust.")


def test_typographic_characters_are_normalised():
    """Smart quotes and em dashes differ between what a model emits and what an editor stored."""
    assert quote_is_supported(
        "the engine\u2019s write path \u2014 rewritten",  # smart quote, em dash
        "We changed the engine's write path - rewritten in Rust.",
    )


def test_a_dropped_parenthetical_still_verifies():
    """A real citation with a clause elided. Rejecting these produces false 'missing'."""
    assert quote_is_supported(
        "took throughput from 12k to 180k events a second",
        "Took sustained throughput from 12k to 180k (peak higher) events a second.",
    )


def test_an_invented_quote_is_rejected():
    assert not quote_is_supported(
        "shipped a Kubernetes operator for the mesh",
        "We rewrote the write-ahead log in Rust and halved the disk footprint.",
    )


def test_a_quote_assembled_from_two_passages_is_rejected():
    """The subtle fabrication: every word is real, the sentence never existed."""
    assert not quote_is_supported(
        "rewrote the iOS client in Swift using HealthKit and Core Bluetooth pairing flows",
        "We rewrote the write-ahead log in Rust.",
    )


def test_citation_to_an_unseen_passage_is_dropped():
    result = verify(
        [finding("met", [EvidenceRef(document_id=999, quote="anything at all here")])],
        [passage(1, "We rewrote the log in Rust.")],
        {"Rust in production": True},
    )

    assert result.rejected == 1
    assert result.findings[0].status == "missing"
    assert result.findings[0].evidence == []


def test_unverifiable_quote_demotes_the_claim():
    """A 'met' that loses its evidence becomes 'missing', not a weaker 'met'."""
    result = verify(
        [finding("met", [EvidenceRef(document_id=1, quote="shipped an iOS app to the store")])],
        [passage(1, "We rewrote the log in Rust.")],
        {"Rust in production": True},
    )

    assert result.rejected == 1
    assert result.findings[0].status == "missing"
    assert "withdrawn" in result.findings[0].rationale


def test_good_evidence_survives_intact():
    result = verify(
        [finding("met", [EvidenceRef(document_id=1, quote="rewrote the log in Rust")])],
        [passage(1, "We rewrote the log in Rust and halved the footprint.")],
        {"Rust in production": True},
    )

    assert result.rejected == 0
    assert result.findings[0].status == "met"
    assert result.findings[0].evidence[0].source_label == "Vector Core"
    assert result.cited_document_ids == {1}


def test_partial_survives_one_good_citation_among_bad_ones():
    """Bad citations are dropped individually; the claim stands on what is left."""
    result = verify(
        [
            finding(
                "partial",
                [
                    EvidenceRef(document_id=1, quote="rewrote the log in Rust"),
                    EvidenceRef(document_id=42, quote="and shipped it to the App Store"),
                ],
            )
        ],
        [passage(1, "We rewrote the log in Rust.")],
        {"Rust in production": True},
    )

    assert result.rejected == 1
    assert result.findings[0].status == "partial"
    assert len(result.findings[0].evidence) == 1


def test_missing_needs_no_evidence():
    result = verify(
        [finding("missing", [])],
        [passage(1, "Unrelated content.")],
        {"Rust in production": True},
    )

    assert result.rejected == 0
    assert result.findings[0].status == "missing"


def test_essentialness_comes_from_the_extraction_not_the_assessment():
    """The assessing model is never asked whether a requirement is essential.

    It is decided when the posting is read and carried through, so a model that decided a
    requirement it could not evidence was 'only a nice to have' could not lower the bar it
    is being measured against.
    """
    result = verify(
        [finding("missing", [], requirement="Swift")],
        [passage(1, "Anything.")],
        {"Swift": True},
    )

    assert result.findings[0].is_essential is True
