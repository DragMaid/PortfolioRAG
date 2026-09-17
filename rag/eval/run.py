"""The eval suite.

Two halves, runnable together or apart:

``--retrieval-only``  seeds the fixture, indexes it, and scores retrieval. No provider key,
                      no cost, no network. Fast enough to run on every change to chunking,
                      embedding or fusion — which is the point, because those are the
                      changes whose effect is invisible in a generated answer.

full run              also runs the whole pipeline on each case and grades the output. Costs
                      real money against a real key, so it says what it will cost and asks
                      before it spends anything.

``--local SITE``      the full run, with a signed-in chat web app (gemini, claude, chatgpt)
                      in a browser standing in for the stored key — see rag.providers.web.
                      Headless by default; sign in once with ``python -m rag.webchat login``.
                      Browser conversations and error captures go into the run directory.

Every run is written to ``eval/reports/<run id>/`` with the metadata needed to compare it
with another — see ``eval.reporting``.

Expectations in ``golden.jsonl`` are written as ranges and keyword sets rather than exact
strings, on purpose. A generated report is not deterministic and an eval that asserted on
its prose would fail on every rerun and teach everyone to ignore it. What is asserted is
what must be stable: the verdict band, the score band, which requirements come back met,
and — the part that matters most — that nothing is claimed without evidence.
"""

from __future__ import annotations

import argparse
import dataclasses
import io
import json
import os
import random
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, TextIO

import numpy as np
from tqdm import tqdm

from rag import indexing
from rag.corpus import SourceType
from rag.credentials import load as load_credential
from rag.crypto import decode_encryption_key
from rag.db import close_pool, get_pool
from rag.embeddings import get_embedder
from rag.logging_setup import configure_logging
from rag.pipeline import JobFitPipeline, JobFitRequest
from rag.providers import get_provider
from rag.providers.web import WebProvider
from rag.retrieval import Passage, retrieve
from rag.settings import Settings, get_settings
from rag.webchat import BROWSERS, SITES, WebChatError

from . import fixture, reporting
from .judge import JUDGE_PROMPT, JudgeVerdict, grade, structural_checks
from .metrics import RetrievalScores, evaluate_retrieval, mean

# TODO: probably should just put them in a config class
GOLDEN_PATH = Path(__file__).parent / "datasets" / "golden.jsonl"

DEFAULT_CUTOFF = 6
DEFAULT_SEED = 0
# Specify only providers that support the seeding feature
_SEEDED_PROVIDERS = frozenset({"openai", "gemini", "groq"})


@dataclass
class CaseResult:
    case_id: str
    retrieval: RetrievalScores | None = None
    report: dict[str, Any] | None = None
    structural: dict[str, Any] = field(default_factory=dict)
    judge: JudgeVerdict | None = None
    expectation_failures: list[str] = field(default_factory=list)
    error: str | None = None
    queries: list[str] = field(default_factory=list)
    retrieved_sources: list[str] = field(default_factory=list)
    failed_stage: str | None = None
    error_artifacts: str | None = None
    exception: BaseException | None = field(default=None, repr=False)
    usage: dict[str, Any] | None = None
    duration_ms: int = 0

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
    """How ``relevant_sources`` in the dataset names a passage's origin."""
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
        "--container",
        action="store_true",
        help=(
            "Run against a throwaway pgvector container, migrated by the API's migrations and "
            "with the embedding column sized to RAG_EMBEDDING_DIMENSIONS, instead of "
            "RAG_DATABASE_URL. Needs Docker and dotnet. Cannot be combined with --author-id."
        ),
    )
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
    parser.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_SEED,
        help=(
            f"Seed for Python's and numpy's RNGs and, where the provider accepts one, for "
            f"model sampling (default {DEFAULT_SEED}). Retrieval is deterministic without it; "
            "model output is only as repeatable as the provider allows."
        ),
    )
    parser.add_argument(
        "--local",
        choices=sorted(SITES),
        metavar="SITE",
        help=(
            "Run the full pipeline through a signed-in chat web app instead of the stored "
            f"provider key: one of {', '.join(sorted(SITES))}. Free, slow, and unseeded."
        ),
    )
    parser.add_argument(
        "--browser",
        choices=BROWSERS,
        default="camoufox",
        help="Browser for --local (default camoufox, which is the one that works headless).",
    )
    parser.add_argument(
        "--headed",
        action="store_true",
        help="Show the --local browser window, and wait for a sign-in if one is needed.",
    )
    parser.add_argument("--json", action="store_true", help="Machine-readable output.")
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip the confirmation before spending money.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=reporting.REPORTS_DIR,
        help=f"Where run directories are written (default {reporting.REPORTS_DIR}).",
    )
    parser.add_argument(
        "--no-progress",
        action="store_true",
        help="Hide the progress bar. It is hidden anyway when stderr is not a terminal.",
    )
    args = parser.parse_args(argv)

    if args.local and args.retrieval_only:
        parser.error("--local chooses the model for a full run; --retrieval-only uses none.")

    if args.container and args.author_id is not None:
        parser.error("--container starts an empty database; --author-id has nothing to read.")

    seed_environment(args.seed)

    settings = get_settings().model_copy(update={"llm_seed": args.seed})
    configure_logging("WARNING", False)

    if not args.container:
        return _evaluate(args, argv, settings)

    from .container import migrated_database

    print(
        f"Starting a pgvector container with vector({settings.embedding_dimensions}) "
        "embeddings and applying migrations...",
        file=sys.stderr,
    )

    with migrated_database(settings.embedding_dimensions) as database_url:
        return _evaluate(
            args,
            argv,
            settings.model_copy(update={"database_url": database_url}),
        )


def _evaluate(args: argparse.Namespace, argv: list[str] | None, settings: Settings) -> int:

    all_cases = load_cases()
    cases = all_cases

    if args.case:
        cases = [case for case in cases if case["id"] in set(args.case)]

    if not cases:
        print("No cases selected.", file=sys.stderr)
        return 2

    if (
        not args.retrieval_only
        and not args.local
        and not args.yes
        and not _confirm(len(cases), args.judge)
    ):
        return 1

    uses_fixture = args.author_id is None
    mode = "retrieval" if args.retrieval_only else ("full+judge" if args.judge else "full")

    started = reporting.utc_now()
    clock = time.monotonic()

    run: dict[str, Any] = {
        "schema_version": 1,
        "run_id": None,
        "status": "running",
        "started_at": started,
        "finished_at": None,
        "duration_seconds": None,
        "command": ["rag-eval", *(sys.argv[1:] if argv is None else argv)],
        "options": {
            "mode": mode,
            "retrieval_only": args.retrieval_only,
            "judge": args.judge,
            "cutoff_k": args.k,
            "author_id": args.author_id,
            "uses_fixture": uses_fixture,
            "container": args.container,
            "local": (
                {"site": args.local, "browser": args.browser, "headless": not args.headed}
                if args.local
                else None
            ),
            "seed": args.seed,
            "python_hash_seed": os.environ.get("PYTHONHASHSEED"),
        },
        "git": reporting.git_state(),
        "environment": reporting.environment(),
        "settings": reporting.settings_snapshot(settings),
        "dataset": {
            "path": str(GOLDEN_PATH.relative_to(Path(__file__).parent.parent)),
            "sha256": reporting.sha256_file(GOLDEN_PATH),
            "total_cases": len(all_cases),
            "selected_case_ids": [case["id"] for case in cases],
        },
        "fixture": (
            {
                "path": str(fixture.FIXTURE_PATH.relative_to(Path(__file__).parent.parent)),
                "sha256": reporting.sha256_file(fixture.FIXTURE_PATH),
            }
            if uses_fixture
            else None
        ),
        "provider": None,
        "summary": None,
        "cases": [],
    }

    setup_steps = (1 if uses_fixture else 0) + 1 + (0 if args.retrieval_only else 1)
    progress = _Progress(
        total=setup_steps + len(cases) * _steps_per_case(args.retrieval_only, args.judge),
        enabled=not args.no_progress and sys.stderr.isatty(),
    )

    results: list[CaseResult] = []
    writer: reporting.RunWriter | None = None

    def finish(status: str, exit_code: int | None) -> None:
        if writer is None:
            return

        run["status"] = status
        run["finished_at"] = reporting.utc_now()
        run["duration_seconds"] = round(time.monotonic() - clock, 3)
        run["summary"] = _summary(results, args.retrieval_only, exit_code, pipeline)
        writer.write_run(run)

    pipeline: JobFitPipeline | None = None
    web: WebProvider | None = None

    try:
        pool = get_pool(settings)
        embedder = get_embedder(
            settings.embedding_model,
            settings.embedding_dimensions,
            settings.embedding_batch_size,
        )

        with pool.connection() as conn:
            progress.begin("setup", setup_steps)

            if uses_fixture:
                progress.stage("seeding fixture portfolio")
                author_id = fixture.seed(conn)
            else:
                author_id = args.author_id

            progress.stage("indexing portfolio")
            indexing.ensure(conn, settings, embedder, author_id, force=True)

            if args.local:
                progress.stage(f"opening {args.local} in {args.browser}")
                web = WebProvider(
                    browser=args.browser,
                    headless=not args.headed,
                    login_timeout=600 if args.headed else 60,
                    log=progress.write,
                )
                # Opened now so a signed-out profile fails the run here, not once per case.
                web.session(args.local)
                pipeline = JobFitPipeline(
                    settings=settings,
                    provider=web,
                    embedder=embedder,
                    api_key="",
                    model=args.local,
                )
                run["provider"] = {
                    "name": web.name,
                    "model": args.local,
                    "seeded": False,
                    "browser": args.browser,
                    "headless": not args.headed,
                    "usage_estimated": True,
                }
                progress.write(
                    f"note: {args.local} runs in a browser — no seed, and token counts are "
                    "estimates."
                )

            elif not args.retrieval_only:
                progress.stage("loading provider credential")
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
                run["provider"] = {
                    "name": credential.provider,
                    "model": credential.model,
                    "seeded": credential.provider in _SEEDED_PROVIDERS,
                }

                if credential.provider not in _SEEDED_PROVIDERS:
                    progress.write(
                        f"note: {credential.provider} accepts no sampling seed; reports will "
                        "still vary between runs."
                    )

            progress.end()

            # Named once the provider is known, so the directory says what was measured.
            run["run_id"] = reporting.make_run_id(
                started,
                mode.replace("+", "-"),
                (run["provider"] or {}).get("name"),
                (run["provider"] or {}).get("model"),
            )
            writer = reporting.RunWriter(args.output_dir, run["run_id"])
            writer.write_run(run)

            if web is not None:
                web.set_output_dir(writer.directory / "browser")

            for number, case in enumerate(cases, start=1):
                progress.begin(
                    f"[{number}/{len(cases)}] {case['id']}",
                    _steps_per_case(args.retrieval_only, args.judge),
                )

                result = _run_case(
                    conn,
                    settings,
                    embedder,
                    author_id,
                    case,
                    pipeline,
                    args.judge,
                    args.k,
                    progress.stage,
                )
                results.append(result)
                progress.end()

                path = writer.write_case(result.case_id, _case_file(result, case, args.k))
                run["cases"].append(_case_index(result, path.relative_to(writer.directory)))
                writer.write_run(run)

                progress.note_result(result, args.retrieval_only)

                # A signed-out session or a usage cap fails every remaining case the same
                # way, one slow timeout at a time. Stop with what has been measured.
                if (fatal := _fatal_browser_error(result)) is not None:
                    progress.write(f"stopping: {fatal}")
                    raise fatal

            if uses_fixture:
                fixture.purge(conn)

    except KeyboardInterrupt:
        progress.close()
        finish("interrupted", None)
        raise
    except WebChatError as error:
        # Expected when a profile is signed out or capped: say what to do, not a traceback.
        progress.close()
        finish("aborted", 1)
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        if writer is not None:
            print(f"Partial report written to {writer.directory}", file=sys.stderr)
        return 1
    except BaseException:
        progress.close()
        finish("error", None)
        raise
    finally:
        progress.close()
        close_pool()
        if web is not None:
            web.close()

    exit_code = _exit_code(results, args.retrieval_only)

    table = io.StringIO()
    _print_table(results, args.retrieval_only, table)

    if writer is not None:
        writer.write_summary(table.getvalue())

    finish("completed", exit_code)

    if args.json:
        print(json.dumps([_serialize(result) for result in results], indent=2, default=str))
    else:
        print(table.getvalue(), end="")

    if writer is not None:
        print(f"Report written to {writer.directory}", file=sys.stderr)

    return exit_code


def seed_environment(seed: int) -> None:
    """Pins every RNG this process owns.

    Nothing in the pipeline draws from these today — retrieval is SQL and arithmetic, and
    fastembed's ONNX inference is deterministic on CPU — so this is a guard against the next
    shuffle or sample someone adds rather than a fix for a current one. The seed that does
    change results is the one handed to the provider, via ``Settings.llm_seed``.

    PYTHONHASHSEED is not set here: it only takes effect at interpreter start, and no code
    path iterates a set or dict in hash order. It is recorded in run.json instead.
    """
    random.seed(seed)
    np.random.seed(seed)


# The stages one case passes through, in order, for the progress bar's arithmetic.
_PIPELINE_STAGES = ("extract", "retrieve", "assess", "verify", "narrate")


def _steps_per_case(retrieval_only: bool, use_judge: bool) -> int:
    if retrieval_only:
        return 1

    # The eval's own extraction and retrieval scoring, then the pipeline, then the judge.
    return 2 + len(_PIPELINE_STAGES) + (1 if use_judge else 0)


class _Progress:
    """One bar for the whole run, labelled with the block and stage currently running.

    Each ``stage`` call completes the previous one, so the count is of finished stages. A
    case that fails part-way still advances the bar by all of its steps when it ends, so the
    total stays honest.
    """

    def __init__(self, total: int, enabled: bool):
        self._bar = tqdm(
            total=total,
            unit="step",
            file=sys.stderr,
            disable=not enabled,
            dynamic_ncols=True,
            bar_format="{desc} |{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]{postfix}",
        )
        self._prefix = ""
        self._block_end = 0
        self._open = False
        self._counts = {"pass": 0, "warn": 0, "fail": 0}

    def begin(self, prefix: str, steps: int) -> None:
        self._prefix = prefix
        self._block_end = self._bar.n + steps

    def stage(self, name: str) -> None:
        self._complete_open_stage()
        self._bar.set_description_str(f"{self._prefix}: {name}")
        self._open = True

    def end(self) -> None:
        self._complete_open_stage()

        if self._bar.n < self._block_end:
            self._bar.update(self._block_end - self._bar.n)

    def note_result(self, result: CaseResult, retrieval_only: bool) -> None:
        retrieval = result.retrieval
        scores = (
            f"recall {retrieval.recall:.2f} · mrr {retrieval.mrr:.2f} · ndcg {retrieval.ndcg:.2f}"
            if retrieval
            else "no retrieval scores"
        )

        # NOTE: a retrieval-only case is measured, not graded, so it shows its numbers
        # rather than a "pass" that nothing checked
        if retrieval_only:
            label = "error" if result.error else "done"
        else:
            label = result.verdict
            self._counts[label] = self._counts.get(label, 0) + 1
            self._bar.set_postfix_str(
                f"pass {self._counts['pass']} · warn {self._counts['warn']} · "
                f"fail {self._counts['fail']}"
            )

        if not self._bar.disable:
            detail = f" — {result.error}" if result.error else ""
            self._bar.write(f"  {label:>5}  {result.case_id}  {scores}{detail}", file=sys.stderr)

    def write(self, text: str) -> None:
        if self._bar.disable:
            print(text, file=sys.stderr)
        else:
            self._bar.write(text, file=sys.stderr)

    def close(self) -> None:
        self._bar.close()

    def _complete_open_stage(self) -> None:
        if self._open and self._bar.n < self._block_end:
            self._bar.update(1)
        self._open = False


def _run_case(
    conn,
    settings: Settings,
    embedder,
    author_id: int,
    case: dict[str, Any],
    pipeline: JobFitPipeline | None,
    use_judge: bool,
    cutoff: int,
    on_stage=lambda _name: None,
) -> CaseResult:
    result = CaseResult(case_id=case["id"])
    started = time.monotonic()
    usage_before = pipeline.usage if pipeline else None

    def stage(name: str) -> None:
        result.failed_stage = name
        on_stage(name)

    try:
        if pipeline is None:
            # No provider available, so the posting stands in for its own queries. A cruder
            # search than the pipeline's — which is the honest thing to report when the
            # requirement-extraction stage has not run.
            stage("retrieval scoring")
            result.queries = [case["job_description"][:800]]
            result.retrieval, passages = score_retrieval(
                conn, settings, embedder, author_id, case, result.queries, cutoff
            )
            result.retrieved_sources = _distinct_sources(passages)
            result.failed_stage = None
            return result

        stage("eval: extract requirements")
        analysis = pipeline._extract(JobFitRequest(job_description=case["job_description"]))
        result.queries = [requirement.search_query for requirement in analysis.requirements]

        stage("eval: retrieval scoring")
        result.retrieval, passages = score_retrieval(
            conn, settings, embedder, author_id, case, result.queries, cutoff
        )
        result.retrieved_sources = _distinct_sources(passages)

        outcome = pipeline.run(
            conn,
            author_id,
            JobFitRequest(job_description=case["job_description"]),
            on_stage=lambda name: stage(f"pipeline: {name}"),
        )

        result.report = outcome.report
        result.structural = structural_checks(outcome.report, len(analysis.requirements))
        result.expectation_failures = check_expectations(outcome.report, case["expect"])

        if use_judge:
            stage("judge")
            result.judge = _judge(pipeline, outcome.report)

        result.failed_stage = None

    except Exception as error:  # the suite reports a broken case rather than stopping
        result.error = f"{type(error).__name__}: {error}"
        result.exception = error

        if (browser_error := _browser_error(error)) is not None:
            result.error = f"{type(browser_error).__name__}: {browser_error.message}"
            if browser_error.artifacts is not None:
                result.error_artifacts = str(browser_error.artifacts)

    finally:
        result.duration_ms = int((time.monotonic() - started) * 1000)

        if pipeline is not None and usage_before is not None:
            result.usage = reporting.usage_between(usage_before, pipeline.usage)

    return result


def _browser_error(error: BaseException | None) -> WebChatError | None:
    """The browser failure behind ``error``, if any. The pipeline wraps its stage failures,
    so the cause chain is walked rather than the top-level type checked."""
    while error is not None:
        if isinstance(error, WebChatError):
            return error
        error = error.__cause__ or error.__context__
    return None


def _fatal_browser_error(result: CaseResult) -> WebChatError | None:
    error = _browser_error(result.exception)
    return error if error is not None and error.fatal else None


def _distinct_sources(passages: list[Passage]) -> list[str]:
    sources: list[str] = []

    for passage in passages:
        key = source_key(passage)
        if key not in sources:
            sources.append(key)

    return sources


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


def _exit_code(results: list[CaseResult], retrieval_only: bool) -> int:
    # A retrieval-only run reports numbers rather than passing or failing: there is no
    # threshold that is right for every corpus, and a suite that fails on a number somebody
    # picked once is a suite people start passing with --no-verify.
    if retrieval_only:
        return 0

    return 1 if any(result.verdict == "fail" for result in results) else 0


def _summary(
    results: list[CaseResult],
    retrieval_only: bool,
    exit_code: int | None,
    pipeline: JobFitPipeline | None,
) -> dict[str, Any]:
    scored = [result.retrieval for result in results if result.retrieval]

    return {
        "cases_run": len(results),
        "retrieval_mean": {
            "recall": mean([s.recall for s in scored]),
            "precision": mean([s.precision for s in scored]),
            "mrr": mean([s.mrr for s in scored]),
            "ndcg": mean([s.ndcg for s in scored]),
        },
        "verdicts": (
            None
            if retrieval_only
            else {
                verdict: sum(1 for result in results if result.verdict == verdict)
                for verdict in ("pass", "warn", "fail")
            }
        ),
        "errors": sum(1 for result in results if result.error),
        "usage": reporting.usage_dict(pipeline.usage) if pipeline else None,
        "exit_code": exit_code,
    }


def _case_file(result: CaseResult, case: dict[str, Any], cutoff: int) -> dict[str, Any]:
    """Everything about one case: enough to see why it got its verdict without rerunning."""
    return {
        "case_id": result.case_id,
        "note": case.get("note"),
        "verdict": result.verdict,
        "duration_ms": result.duration_ms,
        "error": result.error,
        "failed_stage": result.failed_stage,
        "error_artifacts": result.error_artifacts,
        "input": {
            "job_description": case["job_description"],
            "relevant_sources": case["relevant_sources"],
            "expect": case.get("expect"),
        },
        "retrieval": {
            "cutoff_k": cutoff,
            "queries": result.queries,
            "retrieved_sources": result.retrieved_sources,
            "scores": dataclasses.asdict(result.retrieval) if result.retrieval else None,
        },
        "report": result.report,
        "structural": result.structural,
        "judge": result.judge,
        "expectation_failures": result.expectation_failures,
        "usage": result.usage,
    }


def _case_index(result: CaseResult, path: Path) -> dict[str, Any]:
    """The line for this case in run.json: the headline numbers and where the detail is."""
    report = result.report or {}
    retrieval = result.retrieval

    return {
        "case_id": result.case_id,
        "verdict": result.verdict,
        "score": report.get("score"),
        "report_verdict": report.get("verdict"),
        "recall": retrieval.recall if retrieval else None,
        "mrr": retrieval.mrr if retrieval else None,
        "ndcg": retrieval.ndcg if retrieval else None,
        "error": result.error,
        "duration_ms": result.duration_ms,
        "cost_usd": (result.usage or {}).get("cost_usd"),
        "file": str(path),
    }


def _print_table(results: list[CaseResult], retrieval_only: bool, out: TextIO) -> None:
    def emit(text: str = "", end: str = "\n") -> None:
        out.write(text + end)

    emit()
    emit(f"{'case':30} {'recall':>7} {'mrr':>6} {'ndcg':>6}", end="")
    emit("" if retrieval_only else f" {'score':>6} {'verdict':>10} {'cites':>6}  result")
    emit("-" * (52 if retrieval_only else 92))

    for result in results:
        retrieval = result.retrieval
        recall = f"{retrieval.recall:.2f}" if retrieval else "-"
        mrr = f"{retrieval.mrr:.2f}" if retrieval else "-"
        ndcg = f"{retrieval.ndcg:.2f}" if retrieval else "-"

        emit(f"{result.case_id:30} {recall:>7} {mrr:>6} {ndcg:>6}", end="")

        if not retrieval_only:
            report = result.report or {}
            rejected = result.structural.get("citations_rejected", "-")
            emit(
                f" {report.get('score', '-'):>6} {report.get('verdict', '-')!s:>10}"
                f" {rejected:>6}  {result.verdict}",
                end="",
            )

        emit()

        for failure in result.expectation_failures:
            emit(f"{'':30}   ! {failure}")

        if result.judge and result.judge.unsupported_claims:
            for claim in result.judge.unsupported_claims:
                emit(f"{'':30}   ~ unsupported: {claim[:80]}")

        if result.error:
            emit(f"{'':30}   x {result.error}")

    scored = [result.retrieval for result in results if result.retrieval]

    emit("-" * (52 if retrieval_only else 92))
    emit(
        f"{'mean':30} {mean([s.recall for s in scored]):>7.2f} "
        f"{mean([s.mrr for s in scored]):>6.2f} {mean([s.ndcg for s in scored]):>6.2f}"
    )

    if not retrieval_only:
        passed = sum(1 for result in results if result.verdict == "pass")
        warned = sum(1 for result in results if result.verdict == "warn")
        failed = sum(1 for result in results if result.verdict == "fail")
        emit(f"\n{passed} passed, {warned} warned, {failed} failed")

    emit()


def _serialize(result: CaseResult) -> dict[str, Any]:
    return {
        "case_id": result.case_id,
        "verdict": result.verdict,
        # NOTE: asdict rather than __dict__ — RetrievalScores is a slots dataclass and has none
        "retrieval": dataclasses.asdict(result.retrieval) if result.retrieval else None,
        "score": (result.report or {}).get("score"),
        "report_verdict": (result.report or {}).get("verdict"),
        "structural": result.structural,
        "judge": result.judge.model_dump() if result.judge else None,
        "expectation_failures": result.expectation_failures,
        "error": result.error,
    }


if __name__ == "__main__":
    sys.exit(main())
