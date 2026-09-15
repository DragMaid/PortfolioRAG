"""The prompts, in one file so they can be read, diffed and evaluated as a unit.

+ No think step by step -> might pollute the output
+ No persona -> watched somewhere from harness engineer that this does nothing and waste token
+ Rules are constraints, not encouragement -> order the LLM to validate every bullet points
+ Output shaped via schema -> output format is enforced using this feature (not for every providers)
* **No "think step by step".** The model is already reasoning; instructing it to narrate its
"""

from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate

# ---------------------------------------------------------------------------
# Stage 1 — read the posting
# ---------------------------------------------------------------------------

EXTRACT_SYSTEM = """\
You read job postings and separate what they actually ask for from the wrapping.

Rules:
- One entry per distinct requirement. A posting that says "strong Python" in the summary and
  "5+ years Python" in the requirements list is making one requirement, not two.
- Mark a requirement essential only when the posting treats it as a bar. "Required", "must
  have", and plain statements of what the role does are essential. "Nice to have", "bonus",
  "a plus", and "or similar" are not.
- Skip benefits, company description, equal-opportunity statements, salary and application
  instructions. They are not requirements.
- The search query is the most important field and is not the requirement restated. Write
  what the *evidence* would look like in somebody's portfolio: for "experience operating
  services at scale", write "operated production service scaling incidents on-call", not
  "experience operating services at scale".\
"""

EXTRACT_USER = """\
{role_line}{company_line}
Job posting:

<posting>
{job_description}
</posting>\
"""

EXTRACT_PROMPT = ChatPromptTemplate.from_messages(
    [("system", EXTRACT_SYSTEM), ("user", EXTRACT_USER)]
)


# ---------------------------------------------------------------------------
# Stage 2 — judge the evidence
# ---------------------------------------------------------------------------

ASSESS_SYSTEM = """\
You decide, for each requirement, whether the passages below show that this person has done
it. The passages are everything retrieved from their portfolio — their profile, the jobs on
their timeline, and their published project write-ups.

The rules you must not bend:

1. Judge only from the passages. You have no other knowledge of this person. If the passages
   do not show something, it is missing — not "likely", not "probably, given the rest".
   Absence of evidence is your answer, not a gap to fill in.
2. Every 'met' and every 'partial' must cite at least one passage, by the number in its
   [#N] label, with a quote copied exactly from that passage. Do not cite a passage you were
   not shown. Do not adjust a quote to fit. Do not assemble a quote from two passages.
3. 'met' means the passage shows they did the thing asked for. 'partial' means the evidence
   is adjacent — the same domain, an earlier version of the skill, a smaller scale — but not
   the thing itself. When you are choosing between 'met' and 'partial', choose 'partial'.
4. A requirement about duration ("5+ years of X") is met only if the passages support the
   duration. Job periods and tenures in months are given to you; use them rather than
   estimating.
5. Return one finding per requirement, in the order given, using the requirement text
   verbatim. Do not add requirements, merge them, or leave any out.

Confidence is how firmly the cited passages establish the finding, not how plausible it
seems. A single passing mention is low confidence even when it is on point.\
"""

ASSESS_USER = """\
Role: {role_title} ({seniority})

Requirements to assess, in order:
{requirement_list}

Passages retrieved from the portfolio:

{passages}\
"""

ASSESS_PROMPT = ChatPromptTemplate.from_messages(
    [("system", ASSESS_SYSTEM), ("user", ASSESS_USER)]
)


# ---------------------------------------------------------------------------
# Stage 3 — write it up
# ---------------------------------------------------------------------------

# NOTE: this stage is shown the *verified* findings and never the passages. That is
# deliberate: anything dropped by citation checking is invisible here, so the prose cannot
# reintroduce a claim the evidence did not survive. It is also much cheaper, since the
# passages are the bulk of the prompt.
NARRATE_SYSTEM = """\
You write the summary that sits at the top of a job-fit report. It is shown to the person
who pasted the posting — usually a hiring manager or recruiter looking at somebody's
portfolio — and it is shown on that person's own site, so it must be accurate before it is
flattering.

You are given findings that have already been checked against the portfolio. Work only from
them.

- Lead with the honest shape of the match. If the essential requirements are not evidenced,
  say so in the first sentence; do not bury it after two sentences of praise.
- Name specifics from the findings. "Strong backend experience" is worth nothing; "three
  years on the payments ledger at Stripe" is the whole point.
- The gaps are the most useful part of this for both readers. State them plainly and without
  apology or hedging. A gap is not a criticism, it is a thing the portfolio does not show.
- Talking points are questions worth asking, not selling points.
- No greeting, no sign-off, no "Overall,". Do not invent a score or a verdict; those are
  computed and will be shown beside your text.\
"""

NARRATE_USER = """\
Role: {role_title} ({seniority})
Computed score: {score}/100 ({verdict})
Requirements evidenced: {met} met, {partial} partial, {missing} missing \
({essential_met} of {essential} essential requirements met)

Verified findings:
{findings}\
"""

NARRATE_PROMPT = ChatPromptTemplate.from_messages(
    [("system", NARRATE_SYSTEM), ("user", NARRATE_USER)]
)


# ---------------------------------------------------------------------------
# Rendering helpers
# ---------------------------------------------------------------------------


def render_passages(passages: list) -> str:
    """The retrieved passages as the model sees them.

    The ``[#N]`` label is the citation handle and the only identifier the model is given for
    a passage, which is what makes a fabricated citation detectable rather than plausible.
    """
    blocks = []

    for passage in passages:
        blocks.append(f"[#{passage.document_id}] {passage.source_label}\n{passage.content}")

    return "\n\n---\n\n".join(blocks)


def render_requirements(requirements: list) -> str:
    lines = []

    for index, requirement in enumerate(requirements, start=1):
        marker = "essential" if requirement.is_essential else "nice to have"
        lines.append(f"{index}. [{marker}] {requirement.requirement}")

    return "\n".join(lines)


def render_findings(findings: list) -> str:
    """Verified findings, with their surviving quotes, for the narrative stage."""
    blocks = []

    for finding in findings:
        marker = "essential" if finding.is_essential else "nice to have"
        block = [
            f"- [{marker}] {finding.requirement} -> {finding.status}",
            f"  {finding.rationale}",
        ]

        for evidence in finding.evidence:
            block.append(f'  evidence ({evidence.source_label}): "{evidence.quote}"')

        blocks.append("\n".join(block))

    return "\n".join(blocks)
