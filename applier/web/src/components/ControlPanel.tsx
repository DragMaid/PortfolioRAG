/**
 * What the run is allowed to do, and what it must ask you about.
 *
 * Everything here is saved straight into `applier.yaml`: thresholds, the searches to include,
 * and the toggles that decide how much of the run happens without you.
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

import type { ApplyMode, Describe, Intervention, Settings, Status, Verdict } from "../types";
import { api } from "../api";
import { ExtensionCard } from "./ExtensionCard";

/** What each level actually means for a form that is half filled in. */
const ASKING: Record<Intervention, string> = {
  never:
    "A required question none of your facts answer skips the posting and is recorded. Nothing interrupts you.",
  missing:
    "The run stops and asks, there and then. What you type is written down and used from then on.",
  always:
    "Every question and the answer it would give, with the fact behind it, before the form is filled.",
};

/** Who presses send, and where. */
const SENDING: Record<ApplyMode, string> = {
  auto:
    "JobStreet quick-apply forms are filled and sent in the board's own window. A posting that links out to the employer's site still comes to you.",
  manual:
    "Nothing is sent for you. Each fit waits in the table with its letter written, for you to open in your browser, where the extension fills it.",
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
          <Select
            label="Who sends an application"
            description={SENDING[settings.applyMode]}
            allowDeselect={false}
            value={settings.applyMode}
            data={[
              { value: "auto", label: "The board — quick-apply forms are submitted for you" },
              { value: "manual", label: "You — every fit goes to the manual queue" },
            ]}
            onChange={(value) => value && onChange({ applyMode: value as ApplyMode })}
          />
          {boards.map((board) => (
            <Switch
              key={board}
              size="xs"
              checked={(settings.boardModes[board] ?? settings.applyMode) === "manual"}
              onChange={(event) =>
                onChange({
                  boardModes: {
                    ...settings.boardModes,
                    [board]: event.currentTarget.checked ? "manual" : "auto",
                  },
                })
              }
              label={`Always apply to ${board} by hand`}
            />
          ))}
          <Switch
            checked={describe.boardHeadless}
            onChange={(event) =>
              void api.config.profile({ boardHeadless: event.currentTarget.checked })
            }
            label="Keep the board's browser hidden"
            description={
              describe.boardHeadless
                ? "No window, unless you are needed — a sign-in or a bot check brings one up, and it goes again after."
                : "Its window stays up throughout, so you can watch every form being filled."
            }
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

      {settings.applyMode === "manual" && (
        <Alert color="orange" variant="light" title="Nothing will be sent without you">
          Every posting that fits lands in the table as <b>yours to send</b>, its cover letter
          already written. Press <b>Open</b>: the extension fills the form in your own browser and
          asks you in its side panel about anything it does not know.
        </Alert>
      )}

      <ExtensionCard />

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
            {status.manual > 0 && <Badge color="orange">{status.manual} to send by hand</Badge>}
            {status.waiting > 0 && <Badge color="orange">{status.waiting} waiting on you</Badge>}
          </Group>
        )}
      </Group>

      {status?.finished && (
        <Alert color="green" variant="light" title="Run finished">
          {status.finished}.
        </Alert>
      )}

      {status?.stoppedBecause && (
        <Alert color="gray" variant="light">
          Stopped: {status.stoppedBecause}
        </Alert>
      )}
    </Stack>
  );
}
