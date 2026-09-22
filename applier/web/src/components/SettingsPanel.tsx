/**
 * Everything the config file holds, editable two ways.
 *
 * The structured editors are the main path; the raw view is the escape hatch. Both write the
 * same `applier.yaml` — the one `applier run` reads — so there is no second copy of anything
 * and no state that only the page knows about. Saving goes through a round-trip loader, which
 * is why a file you hand-edited still has its comments afterwards.
 *
 * Keys are the exception and stay out: a provider key is named here by the variable it lives
 * in and reported as set or not. It never reaches this page, the config, or the disk.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Code,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";

import { api } from "../api";
import { PortfolioToken } from "./PortfolioToken";
import type { Describe, Providers, SearchDraft } from "../types";

const say = (error: unknown) => String((error as Error).message ?? error);

export function SettingsPanel({ describe, onSaved }: { describe: Describe; onSaved: () => void }) {
  const save = useCallback(
    async (patch: Record<string, unknown>) => {
      try {
        await api.config.profile(patch);
        onSaved();
      } catch (error) {
        notifications.show({ color: "red", title: "Not saved", message: say(error) });
      }
    },
    [onSaved],
  );

  return (
    <Tabs defaultValue="profile">
      <Tabs.List mb="md">
        <Tabs.Tab value="profile">You</Tabs.Tab>
        <Tabs.Tab value="facts">Facts</Tabs.Tab>
        <Tabs.Tab value="searches">Searches</Tabs.Tab>
        <Tabs.Tab value="model">Model &amp; access</Tabs.Tab>
        <Tabs.Tab value="raw">Raw config</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="profile">
        <Profile describe={describe} onSave={save} />
      </Tabs.Panel>
      <Tabs.Panel value="facts">
        <Facts describe={describe} onSave={save} />
      </Tabs.Panel>
      <Tabs.Panel value="searches">
        <Searches describe={describe} onSave={save} />
      </Tabs.Panel>
      <Tabs.Panel value="model">
        <Stack gap="md">
          <PortfolioToken describe={describe} onSaved={onSaved} />
          <Model onSave={save} />
        </Stack>
      </Tabs.Panel>
      <Tabs.Panel value="raw">
        <RawConfig onSaved={onSaved} />
      </Tabs.Panel>
    </Tabs>
  );
}

type Save = (patch: Record<string, unknown>) => Promise<void>;

function Profile({ describe, onSave }: { describe: Describe; onSave: Save }) {
  const [name, setName] = useState(describe.candidate.name);
  const [email, setEmail] = useState(describe.candidate.email ?? "");
  const [phone, setPhone] = useState(describe.candidate.phone ?? "");
  const [resume, setResume] = useState(describe.resume.select ?? "");
  const [upload, setUpload] = useState(describe.resume.upload ?? "");
  const [letter, setLetter] = useState(describe.notes.letter);
  const [answers, setAnswers] = useState(describe.notes.answers);

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Group grow>
          <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
          <TextInput label="Email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
          <TextInput label="Phone" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
        </Group>

        <Group grow align="flex-start">
          <TextInput
            label="Resume on the board profile"
            description="Part of its name is enough."
            value={resume}
            onChange={(e) => setResume(e.currentTarget.value)}
            disabled={Boolean(upload.trim())}
          />
          <TextInput
            label="Or a file to upload"
            description="A path on this machine, sent with each application."
            value={upload}
            onChange={(e) => setUpload(e.currentTarget.value)}
            disabled={Boolean(resume.trim())}
          />
        </Group>

        <Textarea
          label="Notes for the cover letter"
          description="Steers its wording. Not a fact, and grants nothing."
          autosize
          minRows={2}
          value={letter}
          onChange={(e) => setLetter(e.currentTarget.value)}
        />
        <Textarea
          label="Notes for employer questions"
          description="Which option to take where two fit, how to phrase a number. Also not a fact: an answer still has to point at one."
          autosize
          minRows={2}
          value={answers}
          onChange={(e) => setAnswers(e.currentTarget.value)}
        />

        <Group justify="flex-end">
          <Button
            variant="filled"
            onClick={() =>
              void onSave({
                name,
                email,
                phone,
                resume: { select: resume, upload },
                letterNotes: letter,
                answerNotes: answers,
              })
            }
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

function Facts({ describe, onSave }: { describe: Describe; onSave: Save }) {
  const [facts, setFacts] = useState<[string, string][]>(Object.entries(describe.candidate.facts));

  const set = (index: number, at: 0 | 1, value: string) =>
    setFacts((current) => current.map((row, i) => (i === index ? (at === 0 ? [value, row[1]] : [row[0], value]) : row)));

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Alert color="gray" variant="light">
          Employer questions are answered from these and from nothing else. An answer that does
          not point at one of them is discarded before it reaches a form — which is the whole
          reason a wrong answer never gets submitted, and why a question these do not cover
          stops the run instead of being guessed at.
        </Alert>

        <Table withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>What it states</Table.Th>
              <Table.Th>Your answer</Table.Th>
              <Table.Th w={50} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {facts.map(([key, value], index) => (
              <Table.Tr key={index}>
                <Table.Td>
                  <TextInput size="xs" value={key} onChange={(e) => set(index, 0, e.currentTarget.value)} />
                </Table.Td>
                <Table.Td>
                  <TextInput size="xs" value={value} onChange={(e) => set(index, 1, e.currentTarget.value)} />
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label="Remove"
                    onClick={() => setFacts(facts.filter((_, i) => i !== index))}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        <Group justify="space-between">
          <Button
            size="xs"
            variant="default"
            leftSection={<IconPlus size={14} />}
            onClick={() => setFacts([...facts, ["", ""]])}
          >
            Add a fact
          </Button>
          <Button variant="filled" onClick={() => void onSave({ facts: Object.fromEntries(facts) })}>
            Save
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

function Searches({ describe, onSave }: { describe: Describe; onSave: Save }) {
  const [searches, setSearches] = useState<SearchDraft[]>(
    describe.searches.map((one) => ({
      board: one.board,
      keywords: one.keywords,
      location: one.location,
      url: one.url,
      max_pages: one.maxPages,
      date_range: one.dateRange,
      enabled: one.enabled,
    })),
  );

  const set = (index: number, patch: Partial<SearchDraft>) =>
    setSearches((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        {searches.map((search, index) => (
          <Card key={index} withBorder padding="sm">
            <Stack gap="xs">
              <Group grow>
                <TextInput
                  size="xs"
                  label="Keywords"
                  value={search.keywords}
                  onChange={(e) => set(index, { keywords: e.currentTarget.value })}
                />
                <TextInput
                  size="xs"
                  label="Location"
                  value={search.location ?? ""}
                  onChange={(e) => set(index, { location: e.currentTarget.value || null })}
                />
                <NumberInput
                  size="xs"
                  label="Pages"
                  min={1}
                  max={20}
                  value={search.max_pages ?? 2}
                  onChange={(value) => set(index, { max_pages: Number(value) || 1 })}
                />
                <NumberInput
                  size="xs"
                  label="Listed in last (days)"
                  min={1}
                  value={search.date_range ?? 7}
                  onChange={(value) => set(index, { date_range: Number(value) || null })}
                />
              </Group>
              <TextInput
                size="xs"
                label="Or a search URL, used as given"
                value={search.url ?? ""}
                onChange={(e) => set(index, { url: e.currentTarget.value || null })}
              />
              <Group justify="space-between">
                <Switch
                  size="xs"
                  label="Run this one"
                  checked={search.enabled ?? true}
                  onChange={(e) => set(index, { enabled: e.currentTarget.checked })}
                />
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="red"
                  onClick={() => setSearches(searches.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </Group>
            </Stack>
          </Card>
        ))}

        <Group justify="space-between">
          <Button
            size="xs"
            variant="default"
            leftSection={<IconPlus size={14} />}
            onClick={() =>
              setSearches([
                ...searches,
                { board: describe.boards[0] ?? "jobstreet", keywords: "", enabled: true },
              ])
            }
          >
            Add a search
          </Button>
          <Button
            variant="filled"
            onClick={() =>
              void onSave({ searches: searches.filter((one) => one.keywords.trim() || one.url) })
            }
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

function Model({ onSave }: { onSave: Save }) {
  const [providers, setProviders] = useState<Providers | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    api.providers().then(setProviders).catch(() => undefined);
  }, []);

  if (!providers) return null;

  const { current } = providers;
  const web = current.provider === "web";

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Alert color="gray" variant="light">
          <b>web</b> drives a chat site you are already signed in to: no key, nothing billed, and
          slower. Anything else is an API provider, with its key read from an environment
          variable — the key never reaches this page and is never written to the config.
        </Alert>

        <Group grow>
          <Select
            label="Provider"
            allowDeselect={false}
            value={current.provider}
            data={["web", ...providers.apis]}
            onChange={(value) => value && void onSave({ llm: { provider: value } })}
          />
          {web ? (
            <Select
              label="Chat site"
              allowDeselect={false}
              value={current.site}
              data={providers.sites.map((site) => ({ value: site.id, label: site.name }))}
              onChange={(value) => value && void onSave({ llm: { site: value } })}
            />
          ) : (
            <TextInput
              label="Model"
              placeholder="the provider's default"
              defaultValue={current.model ?? ""}
              onBlur={(e) => void onSave({ llm: { model: e.currentTarget.value } })}
            />
          )}
        </Group>

        {web ? (
          <Group>
            <Button variant="default" onClick={() => void api.signInSite(current.site)}>
              Sign in to {current.site}
            </Button>
            <Button
              variant="subtle"
              onClick={() => {
                setSignedIn(null);
                void api.sites();
              }}
            >
              Check the saved sign-in
            </Button>
            {signedIn === true && <Badge color="green">signed in</Badge>}
            {signedIn === false && <Badge color="orange">not signed in</Badge>}
          </Group>
        ) : (
          <Group align="flex-end">
            <TextInput
              label="Key read from"
              description="An environment variable name. Export it and restart the server to change it."
              defaultValue={current.keyVariable ?? ""}
              onBlur={(e) => void onSave({ llm: { api_key_env: e.currentTarget.value } })}
              style={{ flex: 1 }}
            />
            <Badge color={current.keyIsSet ? "green" : "red"} mb={6}>
              {current.keyIsSet ? "set" : "not set"}
            </Badge>
          </Group>
        )}

        {web && (
          <Switch
            label="Hide the chat site's window"
            checked={current.headless}
            onChange={(e) => void onSave({ llm: { headless: e.currentTarget.checked } })}
          />
        )}
      </Stack>
    </Card>
  );
}

function RawConfig({ onSaved }: { onSaved: () => void }) {
  const [text, setText] = useState("");
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.config
      .raw()
      .then(({ text: body, path: where }) => {
        setText(body);
        setPath(where);
        setError(null);
      })
      .catch((cause) => setError(say(cause)));
  }, []);

  useEffect(load, [load]);

  const write = async () => {
    setSaving(true);
    try {
      await api.config.writeRaw(text);
      setError(null);
      onSaved();
      notifications.show({ title: "Saved", message: "The config was replaced." });
    } catch (cause) {
      setError(say(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Code>{path}</Code>
          <Button size="xs" variant="default" onClick={load}>
            Reload from disk
          </Button>
        </Group>

        <Textarea
          autosize
          minRows={20}
          maxRows={40}
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
          styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)", fontSize: 12 } }}
        />

        {error && (
          <Alert color="red" variant="light" title="Not written">
            <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
              {error}
            </Text>
          </Alert>
        )}

        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Checked against the same loader the server started with. A config that would not load
            is refused whole, so nothing here can leave the tool unable to start.
          </Text>
          <Button variant="filled" loading={saving} onClick={() => void write()}>
            Save
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
