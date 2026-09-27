"""``applier`` — the command line.

applier serve                   the controller: a page that runs it with you watching
applier login  <board>          sign in once, in a visible window; the profile is kept
applier run                     every configured search: assess, decide, apply
applier run --dry-run           the same, stopping every application at its review page
applier apply  <posting-url>    one posting, through the same steps
applier status                  what the ledger holds
applier questions               employer questions no fact answered, most asked first
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from collections import Counter
from collections.abc import Iterator
from contextlib import ExitStack, contextmanager
from dataclasses import dataclass
from pathlib import Path

from rag.settings import get_settings

from . import boards as board_registry
from .answering import Answerer, MemoryAnswerer
from .assessment import Assessor
from .boards.base import JobBoard
from .browser import BrowserSession, Timeout
from .config import Config, load, load_or_create
from .errors import ApplierError
from .ledger import Ledger, Status
from .llm import Llm
from .memory import AnswerMemory
from .pipeline import ApplyPipeline, RunOptions, write_summary
from .secrets import Secrets
from .secrets import required as portfolio_token


def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="applier", description="Find postings, measure them against the portfolio, apply."
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=Path(os.environ.get("APPLIER_CONFIG", "applier.yaml")),
        help="The YAML config (default: $APPLIER_CONFIG, else ./applier.yaml).",
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Show rag's own logs.")
    commands = parser.add_subparsers(dest="command", required=True)

    login = commands.add_parser("login", help="Sign in to a board with a visible window.")
    login.add_argument("board", choices=sorted(board_registry.BOARDS))
    login.add_argument("--timeout", type=float, default=600)

    def applying(sub: argparse.ArgumentParser) -> None:
        sub.add_argument(
            "--dry-run",
            action="store_true",
            help="Fill every form up to its review page, capture it, and submit nothing.",
        )
        sub.add_argument("--headless", action="store_true", help="Hide the board's browser.")
        sub.add_argument(
            "--capture-steps", action="store_true", help="Save every apply step's page."
        )

    run = commands.add_parser("run", help="Run every configured search.")
    applying(run)
    run.add_argument("--limit", type=int, help="Applications this run (overrides the policy).")
    run.add_argument(
        "--retry-skipped",
        action="store_true",
        help="Retry postings skipped for an unanswered question, after adding facts.",
    )
    run.add_argument("--board", help="Only this board's searches.")

    apply = commands.add_parser("apply", help="Apply to one posting by URL.")
    apply.add_argument("url")
    applying(apply)
    apply.add_argument(
        "--ignore-fit", action="store_true", help="Apply even if the policy says it is no fit."
    )

    status = commands.add_parser("status", help="What the ledger holds.")
    status.add_argument("--status", choices=[s.value for s in Status])
    status.add_argument("--limit", type=int, default=25)

    commands.add_parser("questions", help="Employer questions your facts did not answer.")

    serve = commands.add_parser(
        "serve", help="Open the controller: pick, watch and hand-check applications in a page."
    )
    serve.add_argument("--port", type=int, default=8765)
    serve.add_argument("--host", default="127.0.0.1", help="Loopback by default. Keep it there.")
    serve.add_argument(
        "--headless",
        action="store_true",
        help="Hide the boards' browser until a sign-in or a bot check needs you (the default "
        "when browser.headless is true).",
    )

    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(levelname)s %(name)s: %(message)s",
    )

    try:
        # `serve` writes a skeleton when there is nothing there: it is the command whose whole
        # job is to get somebody from no config to a working one, so it cannot demand one
        # first. Every other command expects a config that already exists and says so.
        config = load_or_create(args.config) if args.command == "serve" else load(args.config)

        if args.command == "login":
            return _login(config, args.board, args.timeout)
        if args.command == "run":
            return _run(config, args)
        if args.command == "apply":
            return _apply(config, args)
        if args.command == "status":
            return _status(config, args)
        if args.command == "questions":
            return _questions(config)
        if args.command == "serve":
            return _serve(config, args)
    except ApplierError as error:
        log(f"{type(error).__name__}: {error}")
        return 1
    except KeyboardInterrupt:
        log("Interrupted. The ledger has everything up to the posting in progress.")
        return 130

    return 0


# --- wiring -----------------------------------------------------------------


@dataclass(slots=True)
class Wired:
    pipeline: ApplyPipeline
    boards: dict[str, JobBoard]
    ledger: Ledger


def _board(config: Config, name: str, stack: ExitStack, *, headless: bool) -> JobBoard:
    return _board_and_session(config, name, stack, headless=headless)[0]


def _board_and_session(
    config: Config, name: str, stack: ExitStack, *, headless: bool
) -> tuple[JobBoard, BrowserSession]:
    board = board_registry.create(name, **config.boards.for_board(name))
    session = BrowserSession(
        profile=config.state_dir / "profiles" / name,
        captures=config.state_dir / "captures",
        headless=headless,
        log=log,
    )
    stack.enter_context(session)
    board.attach(session)
    return board, session


@contextmanager
def _wired(config: Config, board_names: set[str], *, headless: bool) -> Iterator[Wired]:
    with ExitStack() as stack:
        # Checked before any browser opens: a missing token should cost nothing. The command
        # line cannot stop and ask for one, so this is where it is insisted on — `serve` puts
        # a box on the page instead, and keeps what you paste where this will find it.
        token = portfolio_token(
            Secrets(config.state_dir, token_env=config.portfolio.token_env)
        )

        ledger = Ledger(config.state_dir / "ledger.sqlite")
        stack.callback(ledger.close)

        llm = Llm(config.llm, get_settings(), log=log)
        stack.callback(llm.close)

        memory = AnswerMemory(config.state_dir / "ledger.sqlite")
        stack.callback(memory.close)

        boards = {name: _board(config, name, stack, headless=headless) for name in board_names}

        pipeline = ApplyPipeline(
            config,
            boards=boards,
            assessor=Assessor(llm, api=config.portfolio.api, token=token, log=log),
            answerer=MemoryAnswerer(
                Answerer(
                    llm,
                    config.candidate.all_facts(),
                    notes=config.candidate.answer_notes,
                    log=log,
                ),
                memory,
                log=log,
            ),
            ledger=ledger,
            log=log,
        )
        yield Wired(pipeline=pipeline, boards=boards, ledger=ledger)


def _overrides(config: Config, args: argparse.Namespace) -> bool:
    if args.capture_steps:
        config.browser.capture_steps = True
    return args.headless or config.browser.headless


# --- commands ---------------------------------------------------------------


def _login(config: Config, name: str, timeout: float) -> int:
    with ExitStack() as stack:
        board, session = _board_and_session(config, name, stack, headless=False)
        if board.is_signed_in():
            log(f"Already signed in to {name}. Profile: {session.profile}")
            return 0

        session.goto(board.login_url)
        log(f"Sign in to {name} in the browser window. Waiting up to {timeout:.0f}s...")
        try:
            session.poll(lambda: board.is_signed_in(navigate=False), timeout=timeout, interval=2)
        except Timeout:
            log("Timed out waiting for a sign-in.")
            return 1

    log(f"Signed in. Profile saved under {config.state_dir / 'profiles' / name}.")
    return 0


def _run(config: Config, args: argparse.Namespace) -> int:
    searches = [s.to_search() for s in config.searches if not args.board or s.board == args.board]
    if not searches:
        log("No searches to run.")
        return 1
    if args.limit is not None:
        config.policy.max_applications = args.limit

    headless = _overrides(config, args)
    options = RunOptions(submit=not args.dry_run, retry_skipped=args.retry_skipped)

    with _wired(config, {s.board for s in searches}, headless=headless) as wired:
        summary = wired.pipeline.run(searches, options)
        path = write_summary(summary, config.state_dir / "runs")

    counts = ", ".join(f"{n} {status}" for status, n in sorted(summary.counts().items()))
    log(f"\nDone: {counts or 'nothing found'}. Summary: {path}")
    return 0 if summary.stopped is None or "limit" in summary.stopped else 1


def _apply(config: Config, args: argparse.Namespace) -> int:
    board_name = next((name for name in board_registry.BOARDS if name in args.url.lower()), None)
    if board_name is None:
        log(f"No board recognises {args.url}.")
        return 1

    headless = _overrides(config, args)
    options = RunOptions(submit=not args.dry_run, retry_skipped=True, ignore_fit=args.ignore_fit)

    with _wired(config, {board_name}, headless=headless) as wired:
        board = wired.boards[board_name]
        board.ensure_signed_in()
        listing = board.listing_for(args.url)
        outcome = wired.pipeline.process(board, listing, options)

    if outcome.status is None:
        log(f"Skipped: {outcome.reason}. The ledger will not apply to it twice.")
        return 1
    log(f"\n{outcome.status.value}{f': {outcome.reason}' if outcome.reason else ''}")
    return 0 if outcome.status in (Status.APPLIED, Status.DRY_RUN) else 1


def _status(config: Config, args: argparse.Namespace) -> int:
    ledger = Ledger(config.state_dir / "ledger.sqlite")
    try:
        counts = ledger.counts()
        print("  ".join(f"{status}: {n}" for status, n in sorted(counts.items())) or "Empty.")
        wanted = Status(args.status) if args.status else None
        for entry in ledger.entries(wanted, args.limit):
            fit = f" [{entry.verdict} {entry.score}]" if entry.verdict else ""
            print(f"\n{entry.status.value:<12} {entry.title} — {entry.company or '?'}{fit}")
            print(f"{'':<12} {entry.url}")
            if entry.reason:
                print(f"{'':<12} {entry.reason}")
    finally:
        ledger.close()
    return 0


def _serve(config: Config, args: argparse.Namespace) -> int:
    """Serves the controller on the loopback interface.

    The boards' browser opens with the first search, not with the server, so starting this
    costs nothing until something is actually asked of it.
    """
    import uvicorn

    from .server import create_app

    # Only the flag is an override: browser.headless is read live, so the page can flip it.
    app = create_app(config, headless=args.headless)
    log(f"The controller is at http://{args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port, log_config=None)
    return 0


def _questions(config: Config) -> int:
    ledger = Ledger(config.state_dir / "ledger.sqlite")
    try:
        asked = Counter(
            question
            for entry in ledger.entries(Status.NEEDS_INPUT, limit=1000)
            for question in entry.questions
        )
    finally:
        ledger.close()

    if not asked:
        print("No unanswered questions.")
        return 0

    print("Add facts under candidate.facts that answer these, then: applier run --retry-skipped\n")
    for question, times in asked.most_common():
        print(f"{times:>3}x  {question}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
