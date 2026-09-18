"""Finding the passages that answer a question.

Three stages, each fixing a specific failure of the one before it:
+ Dense and sparse
+ Reciprocal rank fusion, because the two scores are not comparable
+ MMR
"""

from __future__ import annotations

import json
import logging
import math
from dataclasses import dataclass, field
from typing import Any, Protocol

from psycopg import Connection

from rag.corpus import SourceType

from .db import fetch_all, fetch_one
from .embeddings import Embedder

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class Passage:
    """One retrieved chunk, with how it was found."""

    document_id: int
    source_type: SourceType
    source_label: str
    chunk_index: int
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)

    # Populated during fusion, and carried into the trace so a poor answer can be diagnosed.
    score: float = 0.0
    dense_rank: int | None = None
    sparse_rank: int | None = None
    matched_queries: list[str] = field(default_factory=list)
    embedding: list[float] = field(default_factory=list)

    @property
    def citation(self) -> str:
        """How the passage is labelled in the prompt, and how the model must cite it."""
        return f"#{self.document_id}"


_SELECT_COLUMNS = """
    d."Id"           AS document_id,
    d."SourceType"   AS source_type,
    d."SourceLabel"  AS source_label,
    d."ChunkIndex"   AS chunk_index,
    d."Content"      AS content,
    d."MetadataJson" AS metadata
"""


def dense_search(
    conn: Connection,
    author_id: int,
    query_vector: list[float],
    limit: int,
) -> list[Passage]:
    """Nearest neighbours by cosine distance, through the HNSW index."""
    literal = str(query_vector)

    # NOTE: <=> operator calculate the cosine distance
    # NOTE: so the 1 - cosine distance = cosine similarity
    rows = fetch_all(
        conn,
        f"""
        SELECT {_SELECT_COLUMNS},
               1 - (d."Embedding" <=> %(vector)s::vector) AS similarity
        FROM "RagDocuments" d
        WHERE d."AuthorId" = %(author)s AND d."Embedding" IS NOT NULL
        ORDER BY d."Embedding" <=> %(vector)s::vector
        LIMIT %(limit)s
        """,
        {"vector": literal, "author": author_id, "limit": limit},
    )

    return [_to_passage(row, score=float(row["similarity"])) for row in rows]


def sparse_search(
    conn: Connection,
    author_id: int,
    query: str,
    limit: int,
) -> list[Passage]:
    """Keyword matches, ranked by ``ts_rank_cd`` over the generated tsvector."""
    # NOTE: to_tsvector('english', query) - turns query into stemmed lexemes
    # (example: run, running, ran -> run)
    # NOTE: tsvector_to_array() - turn above into array of words
    # NOTE: array_to_string(..., ' | ') - joins the words with | (the OR operator)
    # NOTE: NULLIF(..., '') - return null instead of empty string
    # NOTE: to_tsquery('english', NULL) - return null rather than crash
    # NOTE: ranks the matches using ts_rank_cd (how well terms matched)
    # NOTE: @@ means full-text search match operator
    rows = fetch_all(
        conn,
        f"""
        WITH q AS (
            SELECT to_tsquery(
                'english',
                NULLIF(
                    array_to_string(
                        tsvector_to_array(to_tsvector('english', %(query)s)),
                        ' | '),
                    '')
            ) AS query
        )
        SELECT {_SELECT_COLUMNS},
               ts_rank_cd(d."SearchVector", q.query) AS rank
        FROM "RagDocuments" d, q
        WHERE d."AuthorId" = %(author)s
          AND q.query IS NOT NULL
          AND d."SearchVector" @@ q.query
        ORDER BY rank DESC, d."Id"
        LIMIT %(limit)s
        """,
        {"query": query, "author": author_id, "limit": limit},
    )

    return [_to_passage(row, score=float(row["rank"])) for row in rows]


def reciprocal_rank_fusion(
    ranked_lists: list[list[Passage]],
    k: int = 60,
) -> dict[int, Passage]:
    """Fuses ranked lists into one, keyed by document id."""
    fused: dict[int, Passage] = {}

    # NOTE: this way of ranking does not consider the importance weight
    # for sparse / dense search, only the ranking provided by each.
    # Forumla: sigma(1.0 / (k + rank)) with k being a constant (avoid div by 0)
    for ranked in ranked_lists:
        for rank, passage in enumerate(ranked, start=1):
            existing = fused.get(passage.document_id)

            if existing is None:
                passage.score = 0.0
                fused[passage.document_id] = passage
                existing = passage

            existing.score += 1.0 / (k + rank)

    return fused


def maximal_marginal_relevance(
    passages: list[Passage],
    limit: int,
    diversity_lambda: float = 0.65,
) -> list[Passage]:
    """Picks a shortlist that is relevant and varied (making sure top choices are not same shit)."""
    if len(passages) <= limit:
        return passages

    ranked = sorted(passages, key=lambda passage: passage.score, reverse=True)

    # NOTE: RRF scores are tiny so if we plug them into MMR equation to compare
    # with cosine similarity then the weight will be dominated, hence we are
    # normalizing the values here.
    # NOTE: the two "or 1.0" is to avoid best = worst which cause division by 0
    best = ranked[0].score or 1.0
    worst = ranked[-1].score
    span = (best - worst) or 1.0
    # NOTE: relevance is min-max normalization which showcase whether the document is useful
    relevance = {p.document_id: (p.score - worst) / span for p in ranked}

    chosen: list[Passage] = [ranked[0]]
    remaining = ranked[1:]

    # Keep picking until chosen enough or no more candidates
    while remaining and len(chosen) < limit:
        best_passage = None
        best_value = -math.inf

        for candidate in remaining:
            # NOTE: redundancy measure how similar two documents are, taking only
            # the max value compared to all chosen documents
            redundancy = max(
                (_cosine(candidate.embedding, picked.embedding) for picked in chosen),
                default=0.0,
            )

            # NOTE: MMR = lambda * Relevance(d) - (1 - lambda) * Redundancy(d)
            value = (
                diversity_lambda * relevance[candidate.document_id]
                - (1 - diversity_lambda) * redundancy
            )

            if value > best_value:
                best_value = value
                best_passage = candidate

        # Defensive: unreachable while `remaining` is non-empty, but a None here would be a
        # silent infinite loop rather than an error.
        if best_passage is None:
            break

        chosen.append(best_passage)
        remaining.remove(best_passage)

    return chosen


def retrieve(
    conn: Connection,
    embedder: Embedder,
    author_id: int,
    queries: list[str],
    *,
    dense_k: int,
    sparse_k: int,
    rrf_k: int,
    limit: int,
    diversity_lambda: float,
) -> list[Passage]:
    """The whole search, over several queries at once.

    Several queries because a job description is not one question. Each requirement gets its
    own search, and fusing the lot is what keeps a posting's tenth requirement from being
    drowned out by its first — which is exactly what embedding the whole posting as a single
    vector would do.
    """
    if not queries:
        return []

    query_vectors = embedder.embed_queries(queries)
    ranked_lists: list[list[Passage]] = []
    attribution: dict[int, set[str]] = {}

    for query, vector in zip(queries, query_vectors, strict=True):
        dense = dense_search(conn, author_id, vector, dense_k)
        sparse = sparse_search(conn, author_id, query, sparse_k)

        for rank, passage in enumerate(dense, start=1):
            passage.dense_rank = rank
            attribution.setdefault(passage.document_id, set()).add(query)

        for rank, passage in enumerate(sparse, start=1):
            passage.sparse_rank = rank
            attribution.setdefault(passage.document_id, set()).add(query)

        ranked_lists.append(dense)
        ranked_lists.append(sparse)

    fused = reciprocal_rank_fusion(ranked_lists, k=rrf_k)

    if not fused:
        logger.warning("Retrieval found nothing.", extra={"author_id": author_id})
        return []

    candidates = list(fused.values())

    for passage in candidates:
        passage.matched_queries = sorted(attribution.get(passage.document_id, set()))

    _attach_embeddings(conn, author_id, candidates)

    selected = maximal_marginal_relevance(
        candidates,
        limit=limit,
        diversity_lambda=diversity_lambda,
    )

    logger.info(
        "Retrieved passages.",
        extra={
            "author_id": author_id,
            "queries": len(queries),
            "candidates": len(candidates),
            "selected": len(selected),
        },
    )

    return selected


def _attach_embeddings(conn: Connection, author_id: int, passages: list[Passage]) -> None:
    """Fetches the stored vectors the MMR step compares candidates against.

    One query for the shortlist rather than returning the vector from each search: the same
    passage is commonly returned by half a dozen queries, and 384 floats per row per query
    is a lot of bytes to move for something used once at the end.
    """
    if not passages:
        return

    rows = fetch_all(
        conn,
        """
        SELECT "Id", "Embedding"::text AS embedding
        FROM "RagDocuments"
        WHERE "AuthorId" = %s AND "Id" = ANY(%s)
        """,
        (author_id, [passage.document_id for passage in passages]),
    )

    vectors = {row["Id"]: _parse_vector(row["embedding"]) for row in rows}

    for passage in passages:
        passage.embedding = vectors.get(passage.document_id, [])


def _to_passage(row: dict[str, Any], score: float) -> Passage:
    metadata = row["metadata"]

    return Passage(
        document_id=row["document_id"],
        # NOTE: the column is the int the API's enum is stored as. Converted here, because
        # everything downstream compares against SourceType and an int never equals a member.
        source_type=SourceType(row["source_type"]),
        source_label=row["source_label"],
        chunk_index=row["chunk_index"],
        content=row["content"],
        metadata=metadata if isinstance(metadata, dict) else json.loads(metadata or "{}"),
        score=score,
    )


def _parse_vector(text: str | None) -> list[float]:
    if not text:
        return []
    return [float(part) for part in text.strip("[]").split(",") if part]


def _cosine(left: list[float], right: list[float]) -> float:
    """Similarity between two stored vectors.

    A plain dot product would do — the embedding model emits unit vectors — but the
    normalisation is kept so that a future model that does not costs a little arithmetic
    rather than producing quietly wrong redundancy scores.
    """
    if not left or not right:
        return 0.0

    dot = sum(a * b for a, b in zip(left, right, strict=False))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))

    if left_norm == 0 or right_norm == 0:
        return 0.0

    return dot / (left_norm * right_norm)


class Retriever(Protocol):
    """The corpus, as a pipeline sees it."""

    @property
    def author_name(self) -> str:
        """Who the portfolio belongs to. Only the cover letter needs it."""
        ...

    def search(self, queries: list[str]) -> list[Passage]:
        """The passages these searches turn up, fused and diversified."""
        ...


@dataclass(slots=True)
class DatabaseRetriever:
    """The index in the same database, searched in process. What the worker uses."""

    conn: Connection
    embedder: Embedder
    settings: Any
    author_id: int

    @property
    def author_name(self) -> str:
        row = fetch_one(
            self.conn, 'SELECT "Name" FROM "Authors" WHERE "Id" = %s', (self.author_id,)
        )
        return row["Name"] if row else ""

    def search(self, queries: list[str]) -> list[Passage]:
        return retrieve(
            self.conn,
            self.embedder,
            self.author_id,
            queries,
            dense_k=self.settings.dense_k,
            sparse_k=self.settings.sparse_k,
            rrf_k=self.settings.rrf_k,
            limit=self.settings.context_passages,
            diversity_lambda=self.settings.mmr_lambda,
        )
