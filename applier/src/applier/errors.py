"""What can go wrong applying, sorted by what the run should do about it.

As in ``rag.webchat.errors``, two flags carry the decision so nothing matches on message
text:

* ``fatal`` — nothing later in this run will succeed either (signed out, bot wall, browser
  gone). The run stops rather than failing every remaining posting the same way, slowly.
* ``terminal`` — this posting will never succeed, so the ledger remembers it and later runs
  do not try again. Anything else is recorded as an error and retried next run.
"""

from __future__ import annotations

from pathlib import Path


class ApplierError(RuntimeError):
    fatal = False
    # Terminal determines whether task should be re-tried
    terminal = False

    def __init__(self, message: str, *, artifacts: Path | None = None):
        super().__init__(message)
        self.message = message
        self.artifacts = artifacts

    def __str__(self) -> str:
        where = f" (page captured in {self.artifacts})" if self.artifacts else ""
        return f"{self.message}{where}"


class ConfigError(ApplierError):
    """The config file is missing something the run cannot do without."""

    fatal = True


class LoginRequiredError(ApplierError):
    """The board wants a sign-in. Run `applier login <board>` once, with a window."""

    fatal = True


class ChallengeError(ApplierError):
    """A bot check that did not clear."""

    fatal = True


class BrowserClosedError(ApplierError):
    fatal = True


class FlowError(ApplierError):
    """The apply flow showed something the adapter does not recognise, or refused a step.

    Usually a selector that rotted. Not terminal: once the adapter is fixed the posting is
    worth another go.
    """


class NotApplicableError(ApplierError):
    """This posting cannot be applied to here: a link-out, expired, or already applied."""

    terminal = True


class UnanswerableError(ApplierError):
    """An employer question the candidate's facts do not answer.

    Deliberately not terminal. The questions are recorded against the posting, and once a
    fact that answers them is added to the config, ``--retry-skipped`` picks it up again.
    """

    def __init__(self, questions: list[str], *, artifacts: Path | None = None):
        listed = "; ".join(questions)
        super().__init__(f"No fact answers: {listed}", artifacts=artifacts)
        self.questions = questions
