/** A job's state, in the one colour vocabulary the whole page uses. */

import { Badge, Tooltip } from "@mantine/core";
import type { JobState } from "../types";

interface Look {
  label: string;
  color: string;
  /** True while something is actually happening to it. */
  busy?: boolean;
  hint: string;
}

const LOOKS: Record<JobState, Look> = {
  found: { label: "found", color: "gray", hint: "Turned up by a search, not looked at yet." },
  fetching: { label: "reading", color: "blue", busy: true, hint: "Opening the posting." },
  assessing: {
    label: "assessing",
    color: "blue",
    busy: true,
    hint: "Measuring the posting against your portfolio.",
  },
  pending: {
    label: "waiting on you",
    color: "yellow",
    hint: "A fit. Nothing happens to it until you press Apply.",
  },
  queued: { label: "queued", color: "indigo", hint: "Picked, waiting for a free slot." },
  writing: { label: "writing", color: "blue", busy: true, hint: "Writing the cover letter." },
  applying: { label: "applying", color: "blue", busy: true, hint: "Filling the board's form." },
  reviewing: {
    label: "check answers",
    color: "orange",
    hint: "The employer's questions are answered and waiting for you to look.",
  },
  awaiting_human: {
    label: "yours to send",
    color: "orange",
    hint: "Filled in and sitting at its review page, in a tab. Read it and submit it yourself.",
  },
  applied: { label: "applied", color: "green", hint: "Sent." },
  skipped: { label: "skipped", color: "gray", hint: "You passed on it." },
  unfit: { label: "unfit", color: "gray", hint: "Below the policy's thresholds." },
  excluded: { label: "excluded", color: "gray", hint: "Ruled out by a title or company rule." },
  external: {
    label: "external",
    color: "gray",
    hint: "Applications go through the employer's own site, which this never fills in.",
  },
  unavailable: { label: "unavailable", color: "gray", hint: "Expired, or no apply button." },
  needs_input: {
    label: "needs a fact",
    color: "yellow",
    hint: "A required question none of your facts answered.",
  },
  unconfirmed: {
    label: "unconfirmed",
    color: "red",
    hint: "It may or may not have been sent. Check the board's own activity list — this will never retry it.",
  },
  error: { label: "error", color: "red", hint: "Something went wrong. It will be tried again." },
};

export function StateBadge({ state, reason }: { state: JobState; reason?: string | null }) {
  const look = LOOKS[state] ?? LOOKS.error;

  return (
    <Tooltip label={reason || look.hint} multiline w={280} withArrow openDelay={300}>
      <Badge color={look.color} variant={look.busy ? "filled" : "light"} style={{ cursor: "help" }}>
        {look.label}
      </Badge>
    </Tooltip>
  );
}

export const stateLabel = (state: JobState) => LOOKS[state]?.label ?? state;
export const stateColor = (state: JobState) => LOOKS[state]?.color ?? "gray";
