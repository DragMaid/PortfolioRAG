/**
 * A verdict and a score, together, because neither means much alone.
 *
 * Both are computed in code by the rag pipeline from findings a separate pass verified
 * against the passages — so this is a measurement, not the model's opinion, and it is worth
 * showing as one.
 */

import { Badge, Group, Text, Tooltip } from "@mantine/core";
import type { Verdict } from "../types";

const COLORS: Record<Verdict, string> = {
  weak: "gray",
  partial: "yellow",
  promising: "teal",
  strong: "green",
};

interface Props {
  verdict: Verdict | null;
  score: number | null;
  missingEssentials?: number;
}

export function FitBadge({ verdict, score, missingEssentials = 0 }: Props) {
  if (!verdict) return <Text c="dimmed">—</Text>;

  return (
    <Group gap={6} wrap="nowrap">
      <Badge color={COLORS[verdict]}>
        {verdict} {score ?? "—"}
      </Badge>
      {missingEssentials > 0 && (
        <Tooltip
          label={`${missingEssentials} essential requirement(s) your portfolio shows no evidence of`}
          withArrow
        >
          <Badge color="orange" variant="outline">
            −{missingEssentials}
          </Badge>
        </Tooltip>
      )}
    </Group>
  );
}
