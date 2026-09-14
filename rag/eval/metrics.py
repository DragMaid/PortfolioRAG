"""Retrieval metrics, computed against a labelled set.

Retrieval is evaluated separately from generation for the reason every RAG postmortem
lands on: when an answer is bad, "the model reasoned badly about good passages" and "the
model reasoned perfectly about passages that did not contain the answer" look identical
from the outside and call for opposite fixes. Measuring the retrieval half on its own is
what tells them apart.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


# NOTE: frozen mean do not allow modifying object after creation
# NOTE: slots stop python from creating __dict__ aattribute and replace it with __slots__
# which only stores attribute names and no values -> save storage.
@dataclass(frozen=True, slots=True)
class RetrievalScores:
    recall: float
    precision: float
    mrr: float
    ndcg: float
    retrieved: int
    relevant: int
    hits: int


def evaluate_retrieval(
    retrieved_ids: list[int],
    relevant_ids: set[int],
    k: int | None = None,
) -> RetrievalScores:
    """Scores one query's results against its labelled relevant set.

    Metrics fields:
    + recall - how many relevant docs retrieved 
    + precision - how many of retrieved docs is actually relevant
    + mrr - reciprocal rank, as seen in the scoring module
    + ndcg - evaluate quality of ranking
    """
    ranked = retrieved_ids[:k] if k else retrieved_ids
    hits = [doc_id for doc_id in ranked if doc_id in relevant_ids]

    return RetrievalScores(
        recall=len(hits) / len(relevant_ids) if relevant_ids else 0.0,
        precision=len(hits) / len(ranked) if ranked else 0.0,
        mrr=_reciprocal_rank(ranked, relevant_ids),
        ndcg=_ndcg(ranked, relevant_ids),
        retrieved=len(ranked),
        relevant=len(relevant_ids),
        hits=len(hits),
    )


def _reciprocal_rank(ranked: list[int], relevant: set[int]) -> float:
    for position, doc_id in enumerate(ranked, start=1):
        if doc_id in relevant:
            return 1.0 / position
    return 0.0


def _ndcg(ranked: list[int], relevant: set[int]) -> float:
    """Binary-gain nDCG.

    Binary because the labels are binary: a passage either contains evidence for the
    requirement or it does not, and inventing graded relevance would mean inventing
    judgements nobody made.
    """
    if not relevant:
        return 0.0

    gain = sum(
        1.0 / math.log2(position + 1)
        for position, doc_id in enumerate(ranked, start=1)
        if doc_id in relevant
    )

    # NOTE: ideal would go from position 1 but capped at max of ranked or relevant length
    ideal = sum(
        1.0 / math.log2(position + 1)
        for position in range(1, min(len(relevant), len(ranked)) + 1)
    )

    return gain / ideal if ideal else 0.0


def mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0
