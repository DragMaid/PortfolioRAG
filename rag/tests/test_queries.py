"""The searches a posting's requirements turn into, as the portfolio API will take them."""

from __future__ import annotations

from rag.pipeline import MAX_QUERIES, requirement_queries
from rag.schemas import ExtractedRequirement


def requirement(query: str, *, essential: bool) -> ExtractedRequirement:
    return ExtractedRequirement(
        requirement=query, is_essential=essential, category="skill", search_query=query
    )


def test_a_long_posting_is_trimmed_to_what_the_api_takes_keeping_the_essentials():
    bonuses = [requirement(f"bonus {n}", essential=False) for n in range(10)]
    essentials = [requirement(f"essential {n}", essential=True) for n in range(20)]

    queries = requirement_queries(bonuses + essentials)

    assert len(queries) == MAX_QUERIES
    assert queries[:20] == [f"essential {n}" for n in range(20)]


def test_repeated_and_blank_searches_are_dropped():
    found = [
        requirement("python", essential=True),
        requirement(" python ", essential=False),
        requirement("  ", essential=True),
    ]
    assert requirement_queries(found) == ["python"]
