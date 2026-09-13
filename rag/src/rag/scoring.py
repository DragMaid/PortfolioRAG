"""Turning verified findings into a number.

Computed here, in code, from the statuses that survived citation checking since
asking from the damn model is literally just gamlbing.
"""

from __future__ import annotations

from .schemas import Verdict, VerifiedFinding

_STATUS_VALUE = {"met": 1.0, "partial": 0.5, "missing": 0.0}
_ESSENTIAL_WEIGHT = 1.0
_OPTIONAL_WEIGHT = 0.35
_THRESHOLDS: list[tuple[int, Verdict]] = [
    (85, "strong"),
    (65, "promising"),
    (40, "partial"),
    (0, "weak"),
]


def score(findings: list[VerifiedFinding]) -> int:
    """0 to 100: the weighted share of the posting's requirements that are evidenced."""
    if not findings:
        return 0

    total = 0.0
    earned = 0.0

    for finding in findings:
        weight = _ESSENTIAL_WEIGHT if finding.is_essential else _OPTIONAL_WEIGHT
        total += weight
        earned += weight * _STATUS_VALUE.get(finding.status, 0.0)

    if total == 0:
        return 0

    return round(earned / total * 100)


def verdict(findings: list[VerifiedFinding], value: int) -> Verdict:
    """The one-word reading of the score."""
    essential_unmet = any(
        finding.is_essential and finding.status != "met" for finding in findings
    )

    # Even if user achieve "strong" from threshold, lower it down if its missing essentials
    for threshold, name in _THRESHOLDS:
        if value >= threshold:
            if name == "strong" and essential_unmet:
                return "promising"
            return name

    return "weak"


def summarize(findings: list[VerifiedFinding]) -> dict[str, int]:
    """Counts by status, for the log and for the eval harness."""
    counts = {"met": 0, "partial": 0, "missing": 0, "essential": 0, "essential_met": 0}

    for finding in findings:
        counts[finding.status] = counts.get(finding.status, 0) + 1

        if finding.is_essential:
            counts["essential"] += 1
            if finding.status == "met":
                counts["essential_met"] += 1

    return counts
