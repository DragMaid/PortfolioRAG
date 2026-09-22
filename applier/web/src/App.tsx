/**
 * The controller, as one page.
 *
 * Three things share it: the panel that says how much of the run happens without you, the
 * table of every posting and what you can do about it, and the two rag pipelines that the
 * run itself decides with. The table is the centre — everything else is either a setting
 * that changes what appears in it, or a way of reading one of its rows more closely.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Anchor,
  AppShell,
  Badge,
  Burger,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";

import { api, type ReviewDecision } from "./api";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { SetupWizard } from "./components/SetupWizard";
import { ControlPanel } from "./components/ControlPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { JobDrawer } from "./components/JobDrawer";
import { JobTable } from "./components/JobTable";
import { LogConsole } from "./components/LogConsole";
import { ReviewModal } from "./components/ReviewModal";
import { useController } from "./useController";
import type { Job, Settings } from "./types";

export function App() {
  const controller = useController();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [opened, { toggle }] = useDisclosure(true);
  const [drawer, setDrawer] = useState<Job | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [factModal, setFactModal] = useState(false);

  // The config arrives on the stream's opening frame, along with everything else. This is
  // only here to turn a server that cannot start into a page that explains why, rather than
  // a spinner that never resolves.
  useEffect(() => {
    api.describe().catch((cause) => setLoadError(String(cause.message ?? cause)));
  }, []);

  const describe = controller.describe;

  // Whether each board is still signed in is a page load in the board's own browser, so it
  // is asked for rather than kept fresh: once, when the boards are first known, and again
  // whenever one joins. The answers come back on the event stream.
  const boardCount = Object.keys(controller.status?.boards ?? {}).length;
  useEffect(() => {
    if (boardCount > 0) void api.boards().catch(() => undefined);
  }, [boardCount]);

  const act = useCallback(
    async (job: Job, what: string, work: () => Promise<unknown>) => {
      setBusy((current) => new Set(current).add(job.key));
      try {
        await work();
      } catch (cause) {
        notifications.show({
          color: "red",
          title: `Could not ${what}`,
          message: String((cause as Error).message ?? cause),
        });
      } finally {
        setBusy((current) => {
          const next = new Set(current);
          next.delete(job.key);
          return next;
        });
      }
    },
    [],
  );

  const settings = controller.settings ?? describe?.settings ?? null;
  const setup = controller.setup ?? describe?.setup ?? null;

  const change = useCallback(
    async (patch: Partial<Settings>) => {
      try {
        const next = await api.settings(patch);
        controller.setSettings(next);
      } catch (cause) {
        notifications.show({
          color: "red",
          title: "That setting did not take",
          message: String((cause as Error).message ?? cause),
        });
      }
    },
    [controller],
  );

  const decide = useCallback(
    async (key: string, decision: ReviewDecision) => {
      try {
        await api.review(key, decision);
      } catch (cause) {
        notifications.show({
          color: "red",
          title: "That review is no longer open",
          message: String((cause as Error).message ?? cause),
        });
      }
    },
    [],
  );

  const live = useMemo(
    () => controller.jobs.filter((job) => !job.historic || job.state !== "unfit"),
    [controller.jobs],
  );

  if (loadError) {
    return (
      <Stack p="xl" gap="md">
        <Title order={3}>The controller did not start</Title>
        <Alert color="red" variant="light">
          {loadError}
        </Alert>
        <Text size="sm" c="dimmed">
          Check that `applier serve` is still running, that `applier.yaml` is valid, and that the
          portfolio token is in the environment it names.
        </Text>
      </Stack>
    );
  }

  if (!describe || !settings) {
    return (
      <Group justify="center" p="xl">
        <Loader />
      </Group>
    );
  }

  const status = controller.status;

  // Nothing to show a table of, and no way to fill one: the wizard has the whole page until
  // there is a profile to run with. It is skippable, and reachable again from Settings.
  if (setup && !setup.done) {
    return (
      <SetupWizard
        describe={describe}
        setup={setup}
        signedIn={controller.signedIn}
        onDone={() => void api.describe()}
      />
    );
  }

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 380, breakpoint: "md", collapsed: { mobile: !opened, desktop: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} size="sm" aria-label="Toggle the controls" />
            <Title order={4}>applier</Title>
            <Text size="xs" c="dimmed">
              {describe.candidate.name} · {describe.model.provider === "web" ? describe.model.site : describe.model.provider}
            </Text>
          </Group>
          <Group gap="xs">
            {!controller.connected && (
              <Tooltip label="The event stream dropped. Reconnecting…">
                <Badge color="red">offline</Badge>
              </Tooltip>
            )}
            {status?.running && <Badge color="blue">running</Badge>}
            {status && status.waiting > 0 && (
              <Badge color="orange" variant="filled">
                {status.waiting} waiting on you
              </Badge>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <ScrollArea>
          <ControlPanel
            describe={describe}
            settings={settings}
            status={status}
            signedIn={controller.signedIn}
            onChange={(patch) => void change(patch)}
            onStart={() =>
              api.start().catch((cause) =>
                notifications.show({
                  color: "red",
                  title: "Could not start",
                  message: String(cause.message ?? cause),
                }),
              )
            }
            onStop={() => void api.stop()}
            onSignIn={(board) => void api.signIn(board)}
          />
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>
        <Tabs defaultValue="run">
          <Tabs.List mb="md">
            <Tabs.Tab value="run">
              Run {live.length > 0 && <Badge size="xs" ml={6}>{live.length}</Badge>}
            </Tabs.Tab>
            <Tabs.Tab value="analysis">Paste a posting</Tabs.Tab>
            <Tabs.Tab value="history">History</Tabs.Tab>
            <Tabs.Tab value="settings">
              Settings
              {describe.ready.length > 0 && (
                <Badge size="xs" ml={6} color="orange">
                  {describe.ready.length}
                </Badge>
              )}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="run">
            <Stack gap="md">
              {describe.ready.length > 0 && (
                <Alert color="orange" variant="light" title="Not set up yet">
                  Still needed: {describe.ready.join(", ")}. Until then a run will stop and ask
                  about most postings.
                </Alert>
              )}
              {status?.handoffCapReached && !settings.autoSubmit && (
                <Alert color="orange" variant="light" title="Paused on you">
                  {status.openHandoffs} applications are filled in and waiting in their tabs. Send or
                  discard some and the queue starts again on its own.
                </Alert>
              )}

              <JobTable
                jobs={live}
                busy={busy}
                onOpen={setDrawer}
                onApprove={(job) => void act(job, "apply to it", () => api.approve(job.key))}
                onSkip={(job) => void act(job, "skip it", () => api.skip(job.key))}
                onFocus={(job) => void act(job, "show its tab", () => api.focus(job.key))}
                onSubmitted={(job) => void act(job, "record it as sent", () => api.submitted(job.key))}
                onRetry={(job) => void act(job, "retry it", () => api.retry(job.key))}
              />

              <LogConsole log={controller.log} />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="analysis">
            <Card withBorder padding="md">
              <AnalysisPanel />
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="history">
            <HistoryPanel onAddFact={() => setFactModal(true)} />
          </Tabs.Panel>

          <Tabs.Panel value="settings">
            <Stack gap="md">
              {describe.ready.length > 0 && (
                <Alert color="orange" variant="light" title="A run would not get far yet">
                  Still needed: {describe.ready.join(", ")}.{" "}
                  <Anchor component="button" type="button" onClick={() => void api.setup.state()}>
                    Run setup again
                  </Anchor>{" "}
                  to fill it in from a real form.
                </Alert>
              )}
              <SettingsPanel describe={describe} onSaved={() => void api.describe()} />
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </AppShell.Main>

      <JobDrawer job={drawer} onClose={() => setDrawer(null)} />
      <ReviewModal job={controller.reviewing} onDecide={(key, decision) => void decide(key, decision)} />
      <FactModal opened={factModal} onClose={() => setFactModal(false)} />
    </AppShell>
  );
}

/**
 * Adding a fact from the history tab. It lasts for this session only — `applier.yaml` is
 * read at startup and never written back, so the page says where to paste it to keep it.
 */
function FactModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.addFacts({ [name]: value });
      notifications.show({
        title: "Added for this session",
        message: `Paste "${name}: ${value}" under candidate.facts to keep it.`,
      });
      setName("");
      setValue("");
      onClose();
    } catch (cause) {
      notifications.show({
        color: "red",
        title: "Not added",
        message: String((cause as Error).message ?? cause),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Add a fact">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Answers are built only from facts you have written down. This one lasts for the session;
          put it in your config to keep it.
        </Text>
        <TextInput
          label="The question it answers"
          placeholder="Notice period"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <TextInput
          label="The answer"
          placeholder="1 month"
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="filled"
            loading={saving}
            disabled={!name.trim() || !value.trim()}
            onClick={() => void save()}
          >
            Add
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
