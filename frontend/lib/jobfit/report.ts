/**
 * Presentation rules for a job-fit report, in one place.
 *
 * The studio and the public portfolio render the same report and must not describe it
 * differently — an owner testing the feature is looking at what a visitor will see, and a
 * verdict that reads warmer on one screen than the other would make that rehearsal useless.
 */

import {
  JobFitVerdict,
  RequirementStatus,
  type RagJobDto,
  type RequirementAssessmentDto,
} from "@/lib/api/generated";
import { RagJobStatus } from "@/lib/api/generated";

/** How each verdict is worded and coloured. */
export const VERDICT_COPY: Record<
  JobFitVerdict,
  { label: string; blurb: string; tone: "strong" | "good" | "mixed" | "weak" }
> = {
  [JobFitVerdict.Strong]: {
    label: "Strong match",
    blurb: "Everything this posting treats as essential is evidenced in the portfolio.",
    tone: "strong",
  },
  [JobFitVerdict.Promising]: {
    label: "Promising",
    blurb: "Most of what the posting asks for is evidenced; some of it is not.",
    tone: "good",
  },
  [JobFitVerdict.Partial]: {
    label: "Partial match",
    blurb: "Some of the posting is answered. The important requirements are not.",
    tone: "mixed",
  },
  [JobFitVerdict.Weak]: {
    label: "Weak match",
    blurb: "Little in this portfolio speaks to what the posting is asking for.",
    tone: "weak",
  },
};

export const STATUS_COPY: Record<RequirementStatus, { label: string; tone: string }> = {
  [RequirementStatus.Met]: { label: "Evidenced", tone: "text-warm-success" },
  [RequirementStatus.Partial]: { label: "Adjacent", tone: "text-warm-accent" },
  [RequirementStatus.Missing]: { label: "Not shown", tone: "text-warm-slate" },
};

/**
 * How long the client waits between polls.
 *
 * Backs off, because the interesting information arrives at the end and a fixed one-second
 * poll on a forty-second job is thirty-nine requests that say "still running". Capped so a
 * job that finishes late is still noticed promptly.
 */
export function pollDelayMs(attempt: number): number {
  const FIRST_DELAY = 1500;
  const CAP = 5000;

  return Math.min(CAP, FIRST_DELAY * 1.25 ** attempt);
}

/** Whether there is any point polling again. */
export function isPending(job: RagJobDto | null): boolean {
  return job?.status === RagJobStatus.Queued || job?.status === RagJobStatus.Running;
}

/**
 * A requirement's confidence, as words.
 *
 * Rendered as a hedge rather than as a number: "0.62" invites a reader to do arithmetic
 * with a figure that does not support it, and the only decision it should inform is how
 * firmly to read the line above.
 */
export function confidenceNote(requirement: RequirementAssessmentDto): string | null {
  const LOW = 0.5;
  const HIGH = 0.8;

  if (requirement.status === RequirementStatus.Missing) return null;

  const confidence = requirement.confidence ?? 0;

  if (confidence >= HIGH) return null;
  if (confidence >= LOW) return "on limited evidence";

  return "on a single passing mention";
}

/** "18,400 in · 2,100 out · $0.14" — the studio's cost line. Never shown to visitors. */
export function formatUsage(job: RagJobDto): string | null {
  const usage = job.report?.usage;
  if (!usage) return null;

  const tokens = new Intl.NumberFormat("en-US");
  const seconds = Math.round((usage.durationMs ?? 0) / 1000);

  return [
    `${tokens.format(usage.inputTokens ?? 0)} in`,
    `${tokens.format(usage.outputTokens ?? 0)} out`,
    formatUsd(usage.costUsd ?? 0),
    `${seconds}s`,
  ].join(" · ");
}

/**
 * Money, at the precision the number actually has.
 *
 * One analysis can cost a fraction of a cent, and rounding that to "$0.00" makes a budget
 * meter look broken; a month of them is dollars, where four decimal places are noise.
 */
export function formatUsd(value: number): string {
  if (value > 0 && value < 0.01) return "<$0.01";
  return `$${value.toFixed(2)}`;
}
