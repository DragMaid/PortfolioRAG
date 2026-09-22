/**
 * What the run is allowed to do, and what it must ask you about.
 *
 * `applier.yaml` is the source of truth and is never written from here. What this panel sets
 * is this session's overrides — thresholds to try out, searches to include, and the three
 * toggles that decide how much of the run happens without you.
 */

import {
  Accordion,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconPlayerPlay, IconPlayerStop } from "@tabler/icons-react";

import type { Describe, Intervention, Settings, Status, Verdict } from "../types";

/** What each level actually means for a form that is half filled in. */
const ASKING: Record<Intervention, string> = {
  never:
    "A required question none of your facts answer skips the posting and is recorded. Nothing interrupts you.",
  missing:
    "The run stops and asks, there and then. What you type is written down and used from then on.",
  always:
    "Every question and the answer it would give, with the fact behind it, before the form is filled.",
};

interface Props {
  describe: Describe;
  settings: Settings;
  status: Status | null;
  signedIn: Record<string, boolean>;
  onChange: (patch: Partial<Settings>) => void;
  onStart: () => void;
  onStop: () => void;
  onSignIn: (board: string) => void;
}

const VERDICTS: Verdict[] = ["weak", "partial", "promising", "strong"];

export function ControlPanel({
  describe,
  settings,
  status,
  signedIn,
  onChange,
  onStart,
  onStop,
  onSignIn,
}: Props) {
  const running = status?.running ?? false;
  const boards = [...new Set(describe.searches.map((search) => search.board))];

  const toggle = (index: number, on: boolean) =>
    onChange({
      searches: on
        ? [...new Set([...settings.searches, index])]
        : settings.searches.filter((one) => one !== index),
    });

  return (
    <Stack gap="md">
      <Card withBorder padding="md">
        <Group justify="space-between" align="center" mb="sm">
          <div>
            <Text fw={600}>Searches</Text>
            <Text size="xs" c="dimmed">
              From {describe.configPath || "applier.yaml"}
            </Text>
          </div>
          <Group gap="xs">
            {boards.map((board) => (
              <Button
                key={board}
                size="xs"
                variant={signedIn[board] === false ? "filled" : "default"}
                color={signedIn[board] === false ? "orange" : undefined}
                onClick={() => onSignIn(board)}
              >
                {signedIn[board] === false ? `Sign in to ${board}` : `${board} sign-in`}
              </Button>
            ))}
          </Group>
        </Group>

        <Stack gap={6}>
          {describe.searches.map((search) => (
            <Checkbox
              key={search.index}
              disabled={running}
              checked={settings.searches.includes(search.index)}
              onChange={(event) => toggle(search.index, event.currentTarget.checked)}
              label={
                <Group gap={6}>
                  <Text size="sm">{search.keywords || search.url}</Text>
                  <Badge size="xs" variant="outline">
                    {search.board}
                  </Badge>
                  {search.location && (
                    <Text size="xs" c="dimmed">
                      {search.location}
                    </Text>
                  )}
                  <Text size="xs" c="dimmed">
                    · {search.maxPages} page(s)
                  </Text>
                </Group>
              }
            />
          ))}
          {describe.searches.length === 0 && (
            <Text size="sm" c="dimmed">
              No searches in the config. Add one under `searches:` and restart.
            </Text>
          )}
        </Stack>
      </Card>

      <Card withBorder padding="md">
        <Text fw={600} mb="xs">
          How much it does on its own
        </Text>
        <Stack gap="sm">
          <Switch
            checked={settings.autoPick}
            onChange={(event) => onChange({ autoPick: event.currentTarget.checked })}
            label="Pick postings itself"
            description={
              settings.autoPick
                ? "Anything that clears the policy goes straight to the form."
                : "Everything that clears the policy waits in the table until you press Apply on it."
            }
          />
          <Switch
            checked={settings.autoSubmit}
            onChange={(event) => onChange({ autoSubmit: event.currentTarget.checked })}
            label="Submit applications itself"
            description={
              settings.autoSubmit
                ? "Forms are filled and sent."
                : "Each form is filled up to its review page and left open in a tab for you to read and send."
            }
            color={settings.autoSubmit ? undefined : "orange"}
          />
          <Select
            label="When to ask you about an answer"
            description={ASKING[settings.answers]}
            allowDeselect={false}
            value={settings.answers}
            data={[
              { value: "never", label: "Never — skip the posting" },
              { value: "missing", label: "When a fact is missing" },
              { value: "always", label: "Always — show me every answer" },
            ]}
            onChange={(value) => value && onChange({ answers: value as Intervention })}
          />
          {!settings.autoSubmit && (
            <NumberInput
              size="xs"
              label="Hand-offs open at once"
              description="Applying pauses at this many rather than filling your browser with tabs."
              min={1}
              max={20}
              value={settings.maxOpenHandoffs}
              onChange={(value) => onChange({ maxOpenHandoffs: Number(value) || 1 })}
            />
          )}
        </Stack>
      </Card>

      <Accordion variant="contained">
        <Accordion.Item value="policy">
          <Accordion.Control>
            <Text size="sm" fw={600}>
              Thresholds for this session
            </Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="xs">
              <Text size="xs" c="dimmed">
                Saved straight into {describe.configPath || "applier.yaml"} — the same file
                `applier run` reads.
              </Text>
              <Group grow>
                <Select
                  size="xs"
                  label="Minimum verdict"
                  data={VERDICTS}
                  allowDeselect={false}
                  value={settings.minVerdict}
                  onChange={(value) => value && onChange({ minVerdict: value as Verdict })}
                />
                <NumberInput
                  size="xs"
                  label="Minimum score"
                  min={0}
                  max={100}
                  value={settings.minScore}
                  onChange={(value) => onChange({ minScore: Number(value) || 0 })}
                />
              </Group>
              <Group grow>
                <NumberInput
                  size="xs"
                  label="Applications this run"
                  min={0}
                  value={settings.maxApplications}
                  onChange={(value) => onChange({ maxApplications: Number(value) || 0 })}
                />
                <NumberInput
                  size="xs"
                  label="Assessments this run"
                  min={0}
                  value={settings.maxAssessments}
                  onChange={(value) => onChange({ maxAssessments: Number(value) || 0 })}
                />
                <NumberInput
                  size="xs"
                  label="Unevidenced essentials allowed"
                  min={0}
                  value={settings.allowMissingEssentials}
                  onChange={(value) => onChange({ allowMissingEssentials: Number(value) || 0 })}
                />
              </Group>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      {!settings.autoSubmit && (
        <Alert color="orange" variant="light" title="Nothing will be sent without you">
          Each application is filled in and left at its review page in its own tab. Read it, then
          either submit it there — this notices and records it — or use the row's buttons.
        </Alert>
      )}

      <Group>
        {running ? (
          <Button
            color="red"
            leftSection={<IconPlayerStop size={16} />}
            onClick={onStop}
            variant="filled"
          >
            Stop
          </Button>
        ) : (
          <Tooltip label="Pick at least one search" disabled={settings.searches.length > 0}>
            <Button
              leftSection={<IconPlayerPlay size={16} />}
              onClick={onStart}
              variant="filled"
              disabled={settings.searches.length === 0}
            >
              Start
            </Button>
          </Tooltip>
        )}
        {status && (
          <Group gap="xs">
            <Badge color="blue">{status.assessed} assessed</Badge>
            <Badge color="green">{status.applied} applied</Badge>
            {status.queued > 0 && <Badge color="indigo">{status.queued} queued</Badge>}
            {status.waiting > 0 && <Badge color="orange">{status.waiting} waiting on you</Badge>}
          </Group>
        )}
      </Group>

      {status?.stoppedBecause && (
        <Alert color="gray" variant="light">
          Stopped: {status.stoppedBecause}
        </Alert>
      )}
    </Stack>
  );
}
