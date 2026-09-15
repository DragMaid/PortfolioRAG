"""Fusion and diversification, tested without a database.

These are pure functions over ranked lists, which is why they are testable at all — and
why keeping them pure was worth doing.
"""

from __future__ import annotations

from rag.corpus import SourceType
from rag.retrieval import (
    Passage,
    _to_passage,
    maximal_marginal_relevance,
    reciprocal_rank_fusion,
)


def test_a_database_row_becomes_a_passage_with_a_source_type_member():
    """The column holds an int; left as one, no passage ever equals SourceType.PROFILE and
    every citation is reported as a post."""
    row = {
        "document_id": 1,
        "source_type": 0,
        "source_label": "Profile",
        "chunk_index": 0,
        "content": "about me",
        "metadata": "{}",
    }

    assert _to_passage(row, 1.0).source_type is SourceType.PROFILE


def passage(document_id: int, label: str = "Post", embedding: list[float] | None = None) -> Passage:
    return Passage(
        document_id=document_id,
        source_type=SourceType.POST,
        source_label=label,
        chunk_index=0,
        content=f"content {document_id}",
        embedding=embedding or [1.0, 0.0],
    )


def test_agreement_between_halves_beats_one_strong_opinion():
    """The property RRF is chosen for.

    Passage 2 is second in both lists; passage 1 is first in one and absent from the other.
    Consensus should win, because a passage both a vector search and a keyword search
    liked is a better bet than one only half the system saw.
    """
    dense = [passage(1), passage(2), passage(3)]
    sparse = [passage(4), passage(2), passage(5)]

    fused = reciprocal_rank_fusion([dense, sparse], k=60)

    assert fused[2].score > fused[1].score
    assert fused[2].score > fused[4].score


def test_fusion_deduplicates_by_document():
    dense = [passage(1), passage(2)]
    sparse = [passage(1), passage(3)]

    fused = reciprocal_rank_fusion([dense, sparse], k=60)

    assert sorted(fused) == [1, 2, 3]


def test_the_constant_flattens_the_top_of_each_list():
    """With k=60, rank 1 and rank 2 are nearly equal; with k=0 rank 1 is worth double."""
    ranked = [passage(1), passage(2)]

    flat = reciprocal_rank_fusion([ranked], k=60)
    steep = reciprocal_rank_fusion([[passage(1), passage(2)]], k=0)

    assert flat[1].score / flat[2].score < 1.05
    assert steep[1].score / steep[2].score == 2.0


def test_mmr_returns_everything_when_under_the_limit():
    passages = [passage(1), passage(2)]

    assert maximal_marginal_relevance(passages, limit=5) == passages


def test_mmr_prefers_variety_over_a_fourth_near_duplicate():
    """A portfolio's strongest project otherwise fills the whole context window."""
    duplicates = []

    for document_id in range(1, 5):
        item = passage(document_id, label="Vector Core", embedding=[1.0, 0.0])
        item.score = 1.0 - document_id * 0.01
        duplicates.append(item)

    different = passage(9, label="Ledger Replay", embedding=[0.0, 1.0])
    different.score = 0.5

    chosen = maximal_marginal_relevance([*duplicates, different], limit=2, diversity_lambda=0.5)

    assert {item.document_id for item in chosen} == {1, 9}


def test_lambda_one_is_plain_ranking():
    """The escape hatch: diversity off should reduce to sorting by score."""
    items = []

    for document_id in range(1, 5):
        item = passage(document_id, embedding=[1.0, 0.0])
        item.score = document_id / 10
        items.append(item)

    chosen = maximal_marginal_relevance(items, limit=2, diversity_lambda=1.0)

    assert [item.document_id for item in chosen] == [4, 3]
