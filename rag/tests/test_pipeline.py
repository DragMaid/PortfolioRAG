"""The pipeline end to end, with a stubbed provider.

Everything except the HTTP call: the prompts render, the chain runs, the structured output
is parsed, citations are verified, the score is computed, the report is assembled in the
shape the API deserialises. Retrieval is real — it runs against the fixture portfolio in a
live database — which is why this is marked ``integration``.

The stub is not a shortcut around the model. It is how the *interesting* cases get tested
at all: a real model will not reliably fabricate a citation on demand, and "what happens
when it cites a passage that was never shown" is precisely the behaviour that has to work.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

import pytest
from eval import fixture
from langchain_core.messages import AIMessage
from langchain_core.runnables import Runnable, RunnableLambda

from rag import indexing
from rag.cover_letter import CoverLetterPipeline, CoverLetterRequest
from rag.db import close_pool, get_pool
from rag.embeddings import get_embedder
from rag.pipeline import JobFitPipeline, JobFitRequest, PipelineError
from rag.providers.base import ModelPrice
from rag.schemas import (
    Assessment,
    CoverLetter,
    EvidenceRef,
    ExtractedRequirement,
    Narrative,
    PostingAnalysis,
    RequirementFinding,
)
from rag.settings import Settings

pytestmark = pytest.mark.integration


class StubProvider:
    """A provider that returns whatever the test told it to, and counts its tokens."""

    name = "stub"

    def __init__(self, responses: dict[type, Any]):
        self.responses = responses
        self.prompts: list[Any] = []

    @property
    def default_model(self) -> str:
        return "stub-model"

    def build(self, **_: Any) -> Any:
        # The chain is `prompt | structured(...)`, so what `build` returns is only ever
        # threaded into `structured`. A marker object is enough.
        return object()

    def structured(self, _model: Any, schema: type) -> Runnable:
        def respond(prompt_value: Any) -> dict[str, Any]:
            self.prompts.append(prompt_value)

            answer = self.responses[schema]

            if isinstance(answer, Exception):
                raise answer

            return {
                "raw": AIMessage(
                    content="",
                    usage_metadata={
                        "input_tokens": 1000,
                        "output_tokens": 100,
                        "total_tokens": 1100,
                    },
                ),
                "parsed": answer,
                "parsing_error": None,
            }

        return RunnableLambda(respond)

    def price(self, _model: str) -> ModelPrice:
        return ModelPrice(Decimal("5.00"), Decimal("25.00"))


REQUIREMENTS = [
    ExtractedRequirement(
        requirement="Rust in a production storage context",
        is_essential=True,
        category="skill",
        search_query="rewrote write-ahead log rust storage engine production",
    ),
    ExtractedRequirement(
        requirement="Ships native iOS applications",
        is_essential=True,
        category="skill",
        search_query="swift ios app store release healthkit",
    ),
    ExtractedRequirement(
        requirement="Has written publicly about their work",
        is_essential=False,
        category="other",
        search_query="published write-up blog post design document",
    ),
]

ANALYSIS = PostingAnalysis(
    role_title="Staff Engineer, Storage",
    company="Acme",
    seniority="staff",
    requirements=REQUIREMENTS,
)

NARRATIVE = Narrative(
    headline="Deep storage experience; no mobile work at all.",
    summary="Two paragraphs about the match.",
    strengths=["Owns a replication layer in production"],
    gaps=["Nothing about iOS"],
    talking_points=["Ask how the anti-entropy repair path was validated"],
)


@pytest.fixture
def settings() -> Settings:
    return Settings()


@pytest.fixture
def indexed(settings: Settings):
    """The fixture portfolio, indexed, in a database the test cleans up after."""
    embedder = get_embedder(
        settings.embedding_model, settings.embedding_dimensions, settings.embedding_batch_size
    )

    with get_pool(settings).connection() as conn:
        author_id = fixture.seed(conn)
        indexing.ensure(conn, settings, embedder, author_id, force=True)

        yield conn, author_id, embedder

        fixture.purge(conn)

    close_pool()


def build(settings: Settings, embedder, responses: dict[type, Any]) -> JobFitPipeline:
    return JobFitPipeline(
        settings=settings,
        provider=StubProvider(responses),
        embedder=embedder,
        api_key="stub",
        model="stub-model",
    )


def run(pipeline: JobFitPipeline, conn, author_id: int) -> dict[str, Any]:
    return pipeline.run(
        conn,
        author_id,
        JobFitRequest(job_description="A posting long enough to be worth reading. " * 6),
    ).report


def find(report: dict[str, Any], needle: str) -> dict[str, Any]:
    return next(r for r in report["requirements"] if needle.lower() in r["requirement"].lower())


def test_a_grounded_report_is_assembled_in_the_shape_the_api_reads(indexed, settings):
    """The happy path, and the wire contract with the .NET side."""
    conn, author_id, embedder = indexed

    passages = _retrieved(conn, settings, embedder, author_id)
    rust_passage = _passage_containing(passages, "Rust")

    assessment = Assessment(
        findings=[
            RequirementFinding(
                requirement=REQUIREMENTS[0].requirement,
                status="met",
                confidence=0.9,
                rationale="The write-ahead log rewrite.",
                evidence=[
                    EvidenceRef(
                        document_id=rust_passage.document_id,
                        quote=_quote_from(rust_passage, "Rust"),
                    )
                ],
            ),
            RequirementFinding(
                requirement=REQUIREMENTS[1].requirement,
                status="missing",
                confidence=0.95,
                rationale="Nothing in the portfolio mentions iOS or Swift.",
                evidence=[],
            ),
            RequirementFinding(
                requirement=REQUIREMENTS[2].requirement,
                status="met",
                confidence=0.8,
                rationale="Several published write-ups.",
                evidence=[
                    EvidenceRef(
                        document_id=rust_passage.document_id,
                        quote=_quote_from(rust_passage, "Rust"),
                    )
                ],
            ),
        ]
    )

    report = run(
        build(
            settings,
            embedder,
            {PostingAnalysis: ANALYSIS, Assessment: assessment, Narrative: NARRATIVE},
        ),
        conn,
        author_id,
    )

    # snake_case throughout, which is what LlmMappingExtensions.WorkerJson reads.
    assert set(report) >= {
        "role_title",
        "company",
        "verdict",
        "score",
        "headline",
        "summary",
        "requirements",
        "strengths",
        "gaps",
        "talking_points",
        "retrieval",
        "usage",
    }

    assert report["headline"] == NARRATIVE.headline
    assert report["role_title"] == ANALYSIS.role_title
    assert report["company"] == ANALYSIS.company
    assert len(report["requirements"]) == 3
    assert report["retrieval"]["citations_rejected"] == 0
    assert report["retrieval"]["passages_cited"] == 1

    # Three calls, each stubbed at 1000 in / 100 out, priced at $5/$25 per million.
    usage = report["usage"]
    assert usage["input_tokens"] == 3000
    assert usage["output_tokens"] == 300
    # A string, so the API's decimal does not lose a fraction of a cent to a float.
    assert usage["cost_usd"] == "0.0225"


def test_an_unmet_essential_keeps_the_verdict_off_strong(indexed, settings):
    conn, author_id, embedder = indexed

    passages = _retrieved(conn, settings, embedder, author_id)
    rust_passage = _passage_containing(passages, "Rust")

    assessment = Assessment(
        findings=[
            RequirementFinding(
                requirement=REQUIREMENTS[0].requirement,
                status="met",
                confidence=0.9,
                rationale="Yes.",
                evidence=[
                    EvidenceRef(
                        document_id=rust_passage.document_id,
                        quote=_quote_from(rust_passage, "Rust"),
                    )
                ],
            ),
            RequirementFinding(
                requirement=REQUIREMENTS[1].requirement,
                status="missing",
                confidence=0.95,
                rationale="No.",
                evidence=[],
            ),
            RequirementFinding(
                requirement=REQUIREMENTS[2].requirement,
                status="met",
                confidence=0.8,
                rationale="Yes.",
                evidence=[
                    EvidenceRef(
                        document_id=rust_passage.document_id,
                        quote=_quote_from(rust_passage, "Rust"),
                    )
                ],
            ),
        ]
    )

    report = run(
        build(
            settings,
            embedder,
            {PostingAnalysis: ANALYSIS, Assessment: assessment, Narrative: NARRATIVE},
        ),
        conn,
        author_id,
    )

    assert report["verdict"] != "strong"
    assert find(report, "iOS")["status"] == "missing"


def test_a_fabricated_citation_is_caught_and_the_claim_withdrawn(indexed, settings):
    """The failure this whole design exists to prevent.

    The model claims the portfolio shows iOS work and cites a passage number it was never
    shown. The claim must not reach the reader, and the rejection must be counted.
    """
    conn, author_id, embedder = indexed

    assessment = Assessment(
        findings=[
            RequirementFinding(
                requirement=REQUIREMENTS[0].requirement,
                status="missing",
                confidence=0.5,
                rationale="No.",
                evidence=[],
            ),
            RequirementFinding(
                requirement=REQUIREMENTS[1].requirement,
                status="met",
                confidence=0.95,
                rationale="They shipped an iOS client.",
                evidence=[
                    EvidenceRef(
                        document_id=999_999,
                        quote="shipped the iOS client to the App Store",
                    )
                ],
            ),
            RequirementFinding(
                requirement=REQUIREMENTS[2].requirement,
                status="missing",
                confidence=0.5,
                rationale="No.",
                evidence=[],
            ),
        ]
    )

    report = run(
        build(
            settings,
            embedder,
            {PostingAnalysis: ANALYSIS, Assessment: assessment, Narrative: NARRATIVE},
        ),
        conn,
        author_id,
    )

    ios = find(report, "iOS")

    assert ios["status"] == "missing"
    assert ios["evidence"] == []
    assert report["retrieval"]["citations_rejected"] == 1
    assert report["score"] == 0


def test_a_quote_that_is_not_in_its_passage_is_caught(indexed, settings):
    """The subtler fabrication: a real passage number, words that were never in it."""
    conn, author_id, embedder = indexed

    passages = _retrieved(conn, settings, embedder, author_id)
    real = passages[0]

    assessment = Assessment(
        findings=[
            RequirementFinding(
                requirement=REQUIREMENTS[0].requirement,
                status="met",
                confidence=0.9,
                rationale="Claimed.",
                evidence=[
                    EvidenceRef(
                        document_id=real.document_id,
                        quote="spent four years writing Swift for a regulated medical device",
                    )
                ],
            ),
            RequirementFinding(
                requirement=REQUIREMENTS[1].requirement, status="missing", confidence=0.9,
                rationale="No.", evidence=[],
            ),
            RequirementFinding(
                requirement=REQUIREMENTS[2].requirement, status="missing", confidence=0.9,
                rationale="No.", evidence=[],
            ),
        ]
    )

    report = run(
        build(
            settings,
            embedder,
            {PostingAnalysis: ANALYSIS, Assessment: assessment, Narrative: NARRATIVE},
        ),
        conn,
        author_id,
    )

    assert find(report, "Rust")["status"] == "missing"
    assert report["retrieval"]["citations_rejected"] == 1


def test_a_posting_with_no_requirements_fails_rather_than_scoring_zero(indexed, settings):
    """Zero requirements would score 0 and read as a damning verdict on the author."""
    conn, author_id, embedder = indexed

    empty = PostingAnalysis(
        role_title="Unclear", company=None, seniority="unclear", requirements=[]
    )

    with pytest.raises(PipelineError, match="No requirements"):
        run(
            build(settings, embedder, {PostingAnalysis: empty, Assessment: None, Narrative: None}),
            conn,
            author_id,
        )


def test_an_empty_index_fails_rather_than_reporting_everything_missing(indexed, settings):
    """The other wrong answer worth failing over: a broken index reading as a weak candidate."""
    conn, author_id, embedder = indexed

    # On the fixture's own connection: its transaction is still open, so a delete from a
    # second connection would be invisible to the read that follows.
    conn.execute('DELETE FROM "RagDocuments" WHERE "AuthorId" = %s', (author_id,))

    with pytest.raises(PipelineError, match="Nothing is indexed"):
        run(
            build(
                settings,
                embedder,
                {PostingAnalysis: ANALYSIS, Assessment: None, Narrative: None},
            ),
            conn,
            author_id,
        )


def test_spend_is_recorded_even_when_a_later_stage_fails(indexed, settings):
    """A budget that only counted successes is one a failing job walks past."""
    conn, author_id, embedder = indexed

    pipeline = build(
        settings,
        embedder,
        {
            PostingAnalysis: ANALYSIS,
            Assessment: RuntimeError("the provider hung up"),
            Narrative: NARRATIVE,
        },
    )

    with pytest.raises(PipelineError):
        run(pipeline, conn, author_id)

    # The extraction call happened and was billed, even though nothing came back.
    assert pipeline.usage.input_tokens == 1000
    assert pipeline.usage.cost_usd > 0


def test_every_requirement_reaches_the_assessment_prompt(indexed, settings):
    """A requirement silently dropped between stages is a gap nobody is told about."""
    conn, author_id, embedder = indexed

    provider = StubProvider(
        {
            PostingAnalysis: ANALYSIS,
            Assessment: Assessment(
                findings=[
                    RequirementFinding(
                        requirement=requirement.requirement,
                        status="missing",
                        confidence=0.5,
                        rationale="No.",
                        evidence=[],
                    )
                    for requirement in REQUIREMENTS
                ]
            ),
            Narrative: NARRATIVE,
        }
    )

    pipeline = JobFitPipeline(
        settings=settings, provider=provider, embedder=embedder, api_key="stub", model="stub-model"
    )

    run(pipeline, conn, author_id)

    assess_prompt = provider.prompts[1].to_string()

    for requirement in REQUIREMENTS:
        assert requirement.requirement in assess_prompt

    # And the passages are labelled the way the model is told to cite them.
    assert "[#" in assess_prompt


def test_a_cover_letter_keeps_only_citations_to_passages_it_was_shown(indexed, settings):
    conn, author_id, embedder = indexed

    passages = _retrieved(conn, settings, embedder, author_id)
    shown = _passage_containing(passages, "Rust")

    provider = StubProvider(
        {
            PostingAnalysis: ANALYSIS,
            CoverLetter: CoverLetter(
                letter="Dear hiring team,\n\nI rewrote a write-ahead log in Rust.\n\nBest,\nMe",
                cited_document_ids=[shown.document_id, shown.document_id, -1],
            ),
        }
    )

    pipeline = CoverLetterPipeline(
        settings=settings,
        provider=provider,
        embedder=embedder,
        api_key="stub",
        model="stub-model",
    )

    outcome = pipeline.write(
        conn,
        author_id,
        CoverLetterRequest(
            job_description="A posting long enough to be worth reading. " * 6,
            notes="Lead with storage.",
        ),
    )

    report = outcome.report

    assert report["letter"].startswith("Dear hiring team")
    # Both read out of the posting rather than supplied by the caller.
    assert report["company"] == ANALYSIS.company
    assert report["role_title"] == ANALYSIS.role_title
    assert [source["document_id"] for source in report["sources"]] == [shown.document_id]
    assert report["sources"][0]["source_type"] in {"profile", "experience", "post"}

    # Two model calls: extraction and the letter.
    assert outcome.usage.input_tokens == 2000
    assert report["usage"]["cost_usd"] == str(outcome.usage.cost_usd)

    # The notes and the author's name reach the prompt.
    rendered = provider.prompts[-1].to_string()
    assert "Lead with storage." in rendered
    assert "Company: Acme" in rendered


def _retrieved(conn, settings: Settings, embedder, author_id: int):
    from rag.retrieval import retrieve

    return retrieve(
        conn,
        embedder,
        author_id,
        [r.search_query for r in REQUIREMENTS],
        dense_k=settings.dense_k,
        sparse_k=settings.sparse_k,
        rrf_k=settings.rrf_k,
        limit=settings.context_passages,
        diversity_lambda=settings.mmr_lambda,
    )


def _passage_containing(passages, needle: str):
    for passage in passages:
        if needle.lower() in passage.content.lower():
            return passage
    raise AssertionError(f"the fixture portfolio has no passage mentioning {needle!r}")


def _quote_from(passage, needle: str) -> str:
    """A real substring of a real passage, so the citation verifies."""
    lowered = passage.content.lower()
    start = lowered.index(needle.lower())
    return passage.content[max(0, start - 30) : start + 40]
