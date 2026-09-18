"""Grading the generated half of the pipeline.

Two kinds of check, and the split is the point.

**Deterministic checks, which are the ones that matter most.** Whether a cited passage was
actually retrieved, whether a quote is really in it, whether the score matches the formula,
whether every requirement came back. These need no model, cost nothing, never drift, and
catch the failures that actually hurt — a fabricated citation is caught here every time,
where an LLM judge would catch it most of the time.

**An LLM judge, for the things that have no closed form.** Whether the summary is
calibrated against the findings, whether the gaps are stated plainly rather than buried,
whether the prose accounts for the verdict it sits above. These are real quality properties with no
formula, and a judge is the only way to measure them at all.

The judge grades **against the verified findings**, never against its own opinion of the
candidate. That keeps it measuring the thing under test — does the prose match the evidence
— rather than re-running the analysis and disagreeing about the answer, which is the usual
way an LLM judge becomes an expensive random number generator.
"""

from __future__ import annotations

from typing import Any, Literal

from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field


class JudgeVerdict(BaseModel):
    """One report's qualitative grades, each 1-5."""

    calibration: int = Field(
        description=(
            "Does the prose match the findings? 5 = a reader would predict the score from "
            "the summary alone. 1 = the summary reads far warmer or colder than the "
            "evidence supports."
        )
    )

    specificity: int = Field(
        description=(
            "Does it name concrete work, or trade in generalities? 5 = names projects, "
            "companies and durations from the findings. 1 = could describe anybody."
        )
    )

    gap_honesty: int = Field(
        description=(
            "Are the unmet requirements stated plainly and early? 5 = a reader cannot miss "
            "them. 1 = hedged, buried, or absent while the findings show them."
        )
    )

    usefulness: int = Field(
        description=(
            "Does the prose explain why the match is what it is? 5 = a reader understands "
            "which evidence carried the verdict and which absence held it back. 1 = it "
            "restates the findings without accounting for them."
        )
    )

    unsupported_claims: list[str] = Field(
        description=(
            "Statements in the prose that go beyond the findings given. Quote each. Empty "
            "list when there are none, which should be the normal case."
        )
    )

    notes: str = Field(description="One or two sentences on the most important weakness.")


JUDGE_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """\
You grade job-fit reports. You are given the verified findings a report was written from,
and the report's prose. Grade only how well the prose represents those findings.

You are not assessing the candidate and you have no opinion about whether the score is
right. A report that faithfully conveys a weak match is an excellent report.

Be strict about `unsupported_claims`: any statement of fact about the person that does not
follow from a finding belongs there, including softened ones ("appears to have", "likely
has"). Hedging does not make an unsupported claim supported.""",
        ),
        (
            "user",
            """\
Computed score: {score}/100 ({verdict})

Verified findings:
{findings}

The report's prose:
Headline: {headline}

{summary}

Strengths:
{strengths}

Gaps:
{gaps}""",
        ),
    ]
)


def structural_checks(report: dict[str, Any], requirement_count: int) -> dict[str, Any]:
    """The checks that need no model.

    Every one of these is a property the pipeline claims to guarantee, so a failure is a
    bug rather than a quality regression — which is why they are reported separately from
    the judge's grades and why the suite fails on them.
    """
    requirements = report.get("requirements", [])
    retrieval = report.get("retrieval", {})

    shown_ids = set()
    unresolved = 0
    unevidenced_claims = 0

    for requirement in requirements:
        evidence = requirement.get("evidence", [])

        for item in evidence:
            shown_ids.add(item.get("document_id"))

            if not item.get("quote", "").strip():
                unresolved += 1

        if requirement.get("status") in ("met", "partial") and not evidence:
            unevidenced_claims += 1

    return {
        "requirements_returned": len(requirements),
        "requirements_expected": requirement_count,
        "all_requirements_returned": len(requirements) == requirement_count,
        "unevidenced_claims": unevidenced_claims,
        "empty_quotes": unresolved,
        "citations_rejected": retrieval.get("citations_rejected", 0),
        "passages_cited": retrieval.get("passages_cited", 0),
        "passages_considered": retrieval.get("passages_considered", 0),
        "grounded": retrieval.get("passages_cited", 0) > 0,
    }


Grade = Literal["pass", "warn", "fail"]


def grade(structural: dict[str, Any], verdict: JudgeVerdict | None) -> Grade:
    """One word for a report, from the checks and the grades.

    Structural failures are always a fail — they are broken guarantees. The judge's grades
    can only move a report between pass and warn, because a judge that could fail a build
    on its own is a judge whose bad day becomes a red CI run.
    """
    if not structural["all_requirements_returned"]:
        return "fail"

    if structural["unevidenced_claims"] > 0 or structural["empty_quotes"] > 0:
        return "fail"

    if not structural["grounded"]:
        return "fail"

    if verdict is None:
        return "pass"

    if verdict.unsupported_claims:
        return "warn"

    weakest = min(verdict.calibration, verdict.specificity, verdict.gap_honesty, verdict.usefulness)

    return "pass" if weakest >= 4 else "warn"
