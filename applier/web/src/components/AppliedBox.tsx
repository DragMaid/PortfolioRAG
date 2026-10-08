/**
 * Whether you have applied to a posting — ticked by you, wherever the run left it.
 *
 * Where you apply is yours to decide, so the run's verdict does not get a say: an unfit row,
 * a skipped one, one that failed or was never assessed can all be ticked once you have sent
 * it yourself, and they then count as applied and are never touched again. Untick to take it
 * back. One the applier sent itself stays ticked: it went, whatever is ticked here.
 */

import { Checkbox, Tooltip } from "@mantine/core";

/** A lane has its form open, or a submit is waiting to be confirmed. */
const BEING_SENT = new Set(["writing", "applying", "reviewing", "unconfirmed", "submitting"]);

interface Props {
  state: string;
  byHand: boolean;
  busy?: boolean;
  onChange: (applied: boolean) => void;
}

export function AppliedBox({ state, byHand, busy = false, onChange }: Props) {
  const applied = state === "applied";
  const locked = (applied && !byHand) || BEING_SENT.has(state);
  const label = applied
    ? byHand
      ? "You applied to it. Untick to take that back."
      : "The applier sent this one."
    : BEING_SENT.has(state)
      ? "Being applied to right now."
      : "Tick once you have applied to it yourself.";

  return (
    // A disabled input sends no hover events, so the tooltip hangs off a wrapper.
    <Tooltip label={label} withArrow openDelay={300}>
      <span style={{ display: "inline-flex" }} onClick={(event) => event.stopPropagation()}>
        <Checkbox
          size="xs"
          color="green"
          checked={applied}
          disabled={locked || busy}
          onChange={(event) => onChange(event.currentTarget.checked)}
          aria-label={label}
        />
      </span>
    </Tooltip>
  );
}
