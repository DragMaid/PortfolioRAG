"""The eval suite.

Two halves, runnable together or apart:

``--retrieval-only``  seeds the fixture, indexes it, and scores retrieval. No provider key,
                      no cost, no network. Fast enough to run on every change to chunking,
                      embedding or fusion — which is the point, because those are the
                      changes whose effect is invisible in a generated answer.

full run              also runs the whole pipeline on each case and grades the output. Costs
                      real money against a real key, so it says what it will cost and asks
                      before it spends anything.

Expectations in ``golden.jsonl`` are written as ranges and keyword sets rather than exact
strings, on purpose. A generated report is not deterministic and an eval that asserted on
its prose would fail on every rerun and teach everyone to ignore it. What is asserted is
what must be stable: the verdict band, the score band, which requirements come back met,
and — the part that matters most — that nothing is claimed without evidence.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from rag import indexing
from rag.corpus import SourceType
from rag.credentials import load as load_credential
from rag.crypto import decode_encryption_key
from rag.db import close_pool, get_pool
from rag.embeddings import get_embedder
from rag.logging_setup import configure_logging
from rag.pipeline import JobFitPipeline, JobFitRequest
from rag.providers import get_provider
from rag.retrieval import Passage, retrieve
from rag.settings import Settings, get_settings

from . import fixture
from .judge import JUDGE_PROMPT, JudgeVerdict, grade, structural_checks
from .metrics import RetrievalScores, evaluate_retrieval, mean

GOLDEN_PATH = Path(__file__).parent / "datasets" / "golden.jsonl"

# How far down the ranking the metrics look, counted in distinct sources. Six because the
# fixture portfolio has eight, and a cutoff at or above the corpus size measures nothing.
DEFAULT_CUTOFF = 6


@dataclass
class CaseResult:
    case_id: str
    retrieval: RetrievalScores | None = None
    report: dict[str, Any] | None = None
    structural: dict[str, Any] = field(default_factory=dict)
    judge: JudgeVerdict | None = None
    expectation_failures: list[str] = field(default_factory=list)
    error: str | None = None

    @property
    def verdict(self) -> str:
        if self.error:
            return "fail"
        if self.expectation_failures:
            return "fail"
        return grade(self.structural, self.judge) if self.structural else "pass"


def load_cases() -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in GOLDEN_PATH.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def source_key(passage: Passage) -> str:
    """How ``relevant_sources`` in the dataset names a passage's origin.
    """
    metadata = passage.metadata or {}

    if passage.source_type == SourceType.PROFILE:
        return "profile"

    if passage.source_type == SourceType.EXPERIENCE:
        return f"experience:{metadata.get('company', passage.source_label)}"

    return f"post:{metadata.get('title', passage.source_label)}"


def score_retrieval(
    conn,
    settings: Settings,
    embedder,
    author_id: int,
    case: dict[str, Any],
    queries: list[str],
    cutoff: int,
) -> tuple[RetrievalScores, list]:
    """Scores one case's retrieval against its labelled sources.

    ``cutoff`` is what makes the number mean something. Retrieval is asked for
    ``context_passages`` passages — two dozen — and a small portfolio has fewer distinct
    sources than that, so scoring the whole list would report a perfect recall for any
    implementation that returns rows at all. Scoring the top few asks the question that
    matters: did the evidence reach the part of the context window the model reads closely?
    """
    passages = retrieve(
        conn,
        embedder,
        author_id,
        queries,
        dense_k=settings.dense_k,
        sparse_k=settings.sparse_k,
        rrf_k=settings.rrf_k,
        limit=settings.context_passages,
        diversity_lambda=settings.mmr_lambda,
    )

    expected = set(case["relevant_sources"])

    # De-duplicated to their origin before scoring, in rank order: four chunks of one post
    # count once, which is what the labels mean and also what MMR is there to encourage.
    retrieved_sources: list[str] = []

    for passage in passages:
        key = source_key(passage)
        if key not in retrieved_sources:
            retrieved_sources.append(key)

    # evaluate_retrieval works in ids; the sources are mapped onto stable integers so the
    # same arithmetic serves both this and any future passage-level labelling.
    index = {name: number for number, name in enumerate(sorted(expected | set(retrieved_sources)))}

    return (
        evaluate_retrieval(
            [index[name] for name in retrieved_sources],
            {index[name] for name in expected},
            k=cutoff,
        ),
        passages,
    )


def check_expectations(report: dict[str, Any], expect: dict[str, Any]) -> list[str]:
    """What the dataset says must hold. Each failure is one line in the output."""
    failures: list[str] = []

    verdict = report.get("verdict")
    score = report.get("score", 0)

    if "verdict_in" in expect and verdict not in expect["verdict_in"]:
        failures.append(f"verdict {verdict!r} not in {expect['verdict_in']}")

    if "score_min" in expect and score < expect["score_min"]:
        failures.append(f"score {score} below minimum {expect['score_min']}")

    if "score_max" in expect and score > expect["score_max"]:
        failures.append(f"score {score} above maximum {expect['score_max']}")

    met_text = " ".join(
        requirement["requirement"].lower()
        for requirement in report.get("requirements", [])
        if requirement.get("status") == "met"
    )

    missing_text = " ".join(
        requirement["requirement"].lower()
        for requirement in report.get("requirements", [])
        if requirement.get("status") == "missing"
    )

    for keyword in expect.get("met_keywords", []):
        if keyword.lower() not in met_text:
            failures.append(f"expected a met requirement mentioning {keyword!r}")

    # The adversarial case lives here: a keyword that must come back missing is a claim the
    # portfolio does not support, and a system inferring from adjacency will fail this.
    for keyword in expect.get("missing_keywords", []):
        if keyword.lower() not in missing_text:
            failures.append(f"expected {keyword!r} to be reported missing")

    return failures


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="rag-eval", description="Evaluate the RAG pipeline.")
    parser.add_argument(
        "--retrieval-only",
        action="store_true",
        help="Score retrieval and stop. Costs nothing and needs no provider key.",
    )
    parser.add_argument(
        "--author-id",
        type=int,
        help="Evaluate against an existing account instead of the fixture portfolio.",
    )
    parser.add_argument(
        "--judge",
        action="store_true",
        help="Also grade the prose with an LLM judge. Adds a call per case.",
    )
    parser.add_argument("--case", action="append", help="Run only these case ids.")
    parser.add_argument(
        "--k",
        type=int,
        default=DEFAULT_CUTOFF,
        help=(
            f"Rank cutoff for the retrieval metrics, in distinct sources (default "
            f"{DEFAULT_CUTOFF}). Raise it to see whether evidence was found at all; leave it "
            "where it is to see whether it was found near the top."
        ),
    )
    parser.add_argument("--json", action="store_true", help="Machine-readable output.")
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip the confirmation before spending money.",
    )
    args = parser.parse_args(argv)

    settings = get_settings()
    configure_logging("WARNING", False)

    cases = load_cases()

    if args.case:
        cases = [case for case in cases if case["id"] in set(args.case)]

    if not cases:
        print("No cases selected.", file=sys.stderr)
        return 2

    if not args.retrieval_only and not args.yes and not _confirm(len(cases), args.judge):
        return 1

    pool = get_pool(settings)
    embedder = get_embedder(
        settings.embedding_model,
        settings.embedding_dimensions,
        settings.embedding_batch_size,
    )

    results: list[CaseResult] = []

    try:
        with pool.connection() as conn:
            author_id = args.author_id or fixture.seed(conn)

            indexing.ensure(conn, settings, embedder, author_id, force=True)

            pipeline = None

            if not args.retrieval_only:
                # NOTE: this thing load the database from the database, not really good for testing
                credential = load_credential(
                    conn,
                    author_id,
                    decode_encryption_key(settings.encryption_key.get_secret_value()),
                )
                pipeline = JobFitPipeline(
                    settings=settings,
                    provider=get_provider(credential.provider),
                    embedder=embedder,
                    api_key=credential.api_key,
                    model=credential.model,
                )

            for case in cases:
                results.append(
                    _run_case(
                        conn, settings, embedder, author_id, case, pipeline, args.judge, args.k
                    )
                )

            if args.author_id is None:
                fixture.purge(conn)

    finally:
        close_pool()

    return _report(results, as_json=args.json, retrieval_only=args.retrieval_only)


def _run_case(
    conn,
    settings: Settings,
    embedder,
    author_id: int,
    case: dict[str, Any],
    pipeline: JobFitPipeline | None,
    use_judge: bool,
    cutoff: int,
) -> CaseResult:
    result = CaseResult(case_id=case["id"])

    try:
        if pipeline is None:
            # No provider available, so the posting stands in for its own queries. A cruder
            # search than the pipeline's — which is the honest thing to report when the
            # requirement-extraction stage has not run.
            queries = [case["job_description"][:800]]
            result.retrieval, _ = score_retrieval(
                conn, settings, embedder, author_id, case, queries, cutoff
            )
            return result

        analysis = pipeline._extract(JobFitRequest(job_description=case["job_description"]))
        queries = [requirement.search_query for requirement in analysis.requirements]

        result.retrieval, _ = score_retrieval(
            conn, settings, embedder, author_id, case, queries, cutoff
        )

        outcome = pipeline.run(
            conn, author_id, JobFitRequest(job_description=case["job_description"])
        )

        result.report = outcome.report
        result.structural = structural_checks(outcome.report, len(analysis.requirements))
        result.expectation_failures = check_expectations(outcome.report, case["expect"])

        if use_judge:
            result.judge = _judge(pipeline, outcome.report)

    except Exception as error:  # the suite reports a broken case rather than stopping
        result.error = f"{type(error).__name__}: {error}"

    return result


def _judge(pipeline: JobFitPipeline, report: dict[str, Any]) -> JudgeVerdict | None:
    """Grades the prose against the findings it was written from."""
    findings = "\n".join(
        f"- [{'essential' if r['is_essential'] else 'nice to have'}] "
        f"{r['requirement']} -> {r['status']}"
        for r in report.get("requirements", [])
    )

    # NOTE: the '|' means pipe into the pipeline
    chain = JUDGE_PROMPT | pipeline.provider.structured(pipeline._reasoner, JudgeVerdict)

    outcome = chain.invoke(
        {
            "score": report.get("score"),
            "verdict": report.get("verdict"),
            "findings": findings,
            "headline": report.get("headline", ""),
            "summary": report.get("summary", ""),
            "strengths": "\n".join(report.get("strengths", [])),
            "gaps": "\n".join(report.get("gaps", [])),
            "talking_points": "\n".join(report.get("talking_points", [])),
        }
    )

    return outcome.get("parsed") if isinstance(outcome, dict) else None


def _confirm(count: int, use_judge: bool) -> bool:
    calls = count * (4 if use_judge else 3)

    print(
        f"This will run {count} case(s) through the full pipeline: about {calls} model calls "
        f"against the stored provider key, and real money.\n"
        f"Use --retrieval-only to measure retrieval for free.\n"
    )

    return input("Continue? [y/N] ").strip().lower() in ("y", "yes")


def _report(results: list[CaseResult], as_json: bool, retrieval_only: bool) -> int:
    if as_json:
        print(json.dumps([_serialize(result) for result in results], indent=2, default=str))
    else:
        _print_table(results, retrieval_only)

    # A retrieval-only run reports numbers rather than passing or failing: there is no
    # threshold that is right for every corpus, and a suite that fails on a number somebody
    # picked once is a suite people start passing with --no-verify.
    if retrieval_only:
        return 0

    return 1 if any(result.verdict == "fail" for result in results) else 0


def _print_table(results: list[CaseResult], retrieval_only: bool) -> None:
    print()
    print(f"{'case':30} {'recall':>7} {'mrr':>6} {'ndcg':>6}", end="")
    print("" if retrieval_only else f" {'score':>6} {'verdict':>10} {'cites':>6}  result")
    print("-" * (52 if retrieval_only else 92))

    for result in results:
        retrieval = result.retrieval
        recall = f"{retrieval.recall:.2f}" if retrieval else "-"
        mrr = f"{retrieval.mrr:.2f}" if retrieval else "-"
        ndcg = f"{retrieval.ndcg:.2f}" if retrieval else "-"

        print(f"{result.case_id:30} {recall:>7} {mrr:>6} {ndcg:>6}", end="")

        if not retrieval_only:
            report = result.report or {}
            rejected = result.structural.get("citations_rejected", "-")
            print(
                f" {report.get('score', '-'):>6} {report.get('verdict', '-')!s:>10}"
                f" {rejected:>6}  {result.verdict}",
                end="",
            )

        print()

        for failure in result.expectation_failures:
            print(f"{'':30}   ! {failure}")

        if result.judge and result.judge.unsupported_claims:
            for claim in result.judge.unsupported_claims:
                print(f"{'':30}   ~ unsupported: {claim[:80]}")

        if result.error:
            print(f"{'':30}   x {result.error}")

    scored = [result.retrieval for result in results if result.retrieval]

    print("-" * (52 if retrieval_only else 92))
    print(
        f"{'mean':30} {mean([s.recall for s in scored]):>7.2f} "
        f"{mean([s.mrr for s in scored]):>6.2f} {mean([s.ndcg for s in scored]):>6.2f}"
    )

    if not retrieval_only:
        passed = sum(1 for result in results if result.verdict == "pass")
        warned = sum(1 for result in results if result.verdict == "warn")
        failed = sum(1 for result in results if result.verdict == "fail")
        print(f"\n{passed} passed, {warned} warned, {failed} failed")

    print()


def _serialize(result: CaseResult) -> dict[str, Any]:
    return {
        "case_id": result.case_id,
        "verdict": result.verdict,
        "retrieval": result.retrieval.__dict__ if result.retrieval else None,
        "score": (result.report or {}).get("score"),
        "report_verdict": (result.report or {}).get("verdict"),
        "structural": result.structural,
        "judge": result.judge.model_dump() if result.judge else None,
        "expectation_failures": result.expectation_failures,
        "error": result.error,
    }


if __name__ == "__main__":
    sys.exit(main())
