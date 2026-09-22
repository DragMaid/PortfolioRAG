/** Where a posting has been, and how long each step took. */

import { Group, Text, Timeline } from "@mantine/core";
import type { JobState, Stage } from "../types";
import { stateColor, stateLabel } from "./StateBadge";

const seconds = (value: number | null) => (value == null ? "" : `${value.toFixed(1)}s`);

export function StageTrail({ stages }: { stages: Stage[] }) {
  if (stages.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        Nothing has happened to it yet.
      </Text>
    );
  }

  return (
    <Timeline active={stages.length - 1} bulletSize={14} lineWidth={2}>
      {stages.map((stage, index) => (
        <Timeline.Item
          key={`${stage.name}-${index}`}
          color={stateColor(stage.name as JobState)}
          title={
            <Group gap="xs">
              <Text size="sm" fw={500}>
                {stateLabel(stage.name as JobState)}
              </Text>
              <Text size="xs" c="dimmed">
                {seconds(stage.elapsed)}
              </Text>
            </Group>
          }
        >
          {stage.detail && (
            <Text size="xs" c="dimmed">
              {stage.detail}
            </Text>
          )}
        </Timeline.Item>
      ))}
    </Timeline>
  );
}
