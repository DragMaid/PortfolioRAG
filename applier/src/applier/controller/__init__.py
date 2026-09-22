"""Driving the applier from a page, with a person watching.

The CLI's :class:`~applier.pipeline.ApplyPipeline` decides everything itself and reports
when it is done. The controller runs the same steps against the same boards, ledger and
policy, but pulls two decisions out of the loop and hands them to a person: *is this posting
worth applying to*, and *should this filled-in form be sent*. Either can be left to the
policy, which is what the two toggles mean.

    session.py   the state machine: one Job per posting, what may happen to it next
    worker.py    one thread per board, owning that board's browser and its tabs
    events.py    what the page is told, as it happens
    reviewing.py the answerer, paused for approval when the toggle asks for it
"""

from .events import Bus, Event
from .session import ControllerError, Session
from .state import Job, JobState, RunSettings

__all__ = [
    "Bus",
    "ControllerError",
    "Event",
    "Job",
    "JobState",
    "RunSettings",
    "Session",
]
