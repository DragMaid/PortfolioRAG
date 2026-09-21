"""Job boards, as adapters. See ``base.JobBoard`` for the whole of the contract.

Adding a board (LinkedIn, say) is a package here implementing ``JobBoard`` and one line in
``BOARDS``. Nothing else in the applier knows a board's URLs or selectors.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from .base import ApplyContext, JobBoard
from .jobstreet import JobStreet

BOARDS: dict[str, Callable[..., JobBoard]] = {
    JobStreet.name: JobStreet,
}


def create(name: str, **options: Any) -> JobBoard:
    try:
        factory = BOARDS[name.strip().lower()]
    except KeyError:
        raise ValueError(
            f"No board named {name!r}. Known boards: {', '.join(sorted(BOARDS))}."
        ) from None
    return factory(**options)


__all__ = ["BOARDS", "ApplyContext", "JobBoard", "create"]
