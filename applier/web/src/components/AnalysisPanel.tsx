/**
 * A posting pasted in by hand, measured or written to — the two pipelines `rag-local` used
 * to serve, now beside the run that uses them to decide with.
 *
 * It is the same code either way: the report here is produced by the same six stages that
 * produce the one on a row, against the same portfolio index, through the same signed-in
 * chat session. So this is where you go to see what the run is judging on, with a posting it
 * never found — and it costs nothing, because the model is a chat site you are signed in to.
 */

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CopyButton,
  Group,
  Loader,
  Progress,
  Stack,
  Tabs,
  Text,
  Textarea,
} from "@mantine/core";

import { api } from "../api";
import type { FitReport, LetterReport, RagRun } from "../types";
import { ReportView } from "./ReportView";

const MINIMUM = 120;
const MAXIMUM = 20000;
const POLL_MS = 1200;

const DRAFT = "applier.analysis.draft";
const NOTES = "applier.analysis.notes";

type Kind = "job-fit" | "cover-letter";

export function AnalysisPanel() {
  const [kind, setKind] = useState<Kind>("job-fit");
  const [posting, setPosting] = useState(() => localStorage.getItem(DRAFT) ?? "");
  const [notes, setNotes] = useState(() => localStorage.getItem(NOTES) ?? "");
  const [run, setRun] = useState<RagRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => localStorage.setItem(DRAFT, posting), [posting]);
  useEffect(() => localStorage.setItem(NOTES, notes), [notes]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const follow = (id: string) => {
    timer.current = window.setTimeout(async () => {
      try {
        const next = await api.rag.run(id);
        setRun(next);
        if (next.status === "running") follow(id);
      } catch (cause) {
        setError(String((cause as Error).message ?? cause));
      }
    }, POLL_MS);
  };

  const start = async () => {
    setError(null);
    setStarting(true);
    try {
      const started = await api.rag.start(kind, posting.trim(), notes.trim() || undefined);
      setRun(started);
      follow(started.id);
    } catch (cause) {
      setError(String((cause as Error).message ?? cause));
    } finally {
      setStarting(false);
    }
  };

  const length = posting.trim().length;
  const tooShort = length < MINIMUM;
  const tooLong = length > MAXIMUM;
  const running = run?.status === "running";

  return (
    <Stack gap="md">
      <Tabs value={kind} onChange={(value) => setKind((value as Kind) ?? "job-fit")}>
        <Tabs.List>
          <Tabs.Tab value="job-fit">Job fit</Tabs.Tab>
          <Tabs.Tab value="cover-letter">Cover letter</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <Textarea
        label="Job description"
        description="The role and the company are read out of it; there is nothing else to fill in."
        autosize
        minRows={10}
        maxRows={24}
        value={posting}
        onChange={(event) => setPosting(event.currentTarget.value)}
      />

      {kind === "cover-letter" && (
        <Textarea
          label="Notes (optional)"
          description="Anything to lean on or leave out."
          autosize
          minRows={2}
          maxLength={1000}
          value={notes}
          onChange={(event) => setNotes(event.currentTarget.value)}
        />
      )}

      <Group justify="space-between">
        <Text size="xs" c={tooShort || tooLong ? "orange" : "dimmed"}>
          {length.toLocaleString()} characters
          {tooShort && ` — paste a bit more, at least ${MINIMUM}`}
          {tooLong && ` — over the ${MAXIMUM.toLocaleString()} limit`}
        </Text>
        <Button
          variant="filled"
          onClick={() => void start()}
          disabled={tooShort || tooLong || running}
          loading={starting || running}
        >
          {kind === "job-fit" ? "Measure it" : "Write the letter"}
        </Button>
      </Group>

      {error && (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      )}

      {run && (
        <Card withBorder padding="md">
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              {running && <Loader size="xs" />}
              <Text size="sm" fw={600}>
                {running ? run.stage : run.status}
              </Text>
              <Badge size="sm" variant="light">
                {run.elapsed}s
              </Badge>
            </Group>
            <Group gap={4}>
              {run.stages.map((stage, index) => (
                <Badge key={`${stage}-${index}`} size="xs" variant="outline">
                  {stage}
                </Badge>
              ))}
            </Group>
          </Group>
          {running && <Progress value={100} animated />}
          {run.error && (
            <Alert color="red" variant="light" mt="sm">
              {run.error}
            </Alert>
          )}
        </Card>
      )}

      {run?.status === "succeeded" && run.report && (
        <Card withBorder padding="md">
          {kind === "job-fit" ? (
            <ReportView report={run.report as FitReport} />
          ) : (
            <LetterView report={run.report as LetterReport} />
          )}
        </Card>
      )}
    </Stack>
  );
}

function LetterView({ report }: { report: LetterReport }) {
  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <div>
          <Text fw={600}>{report.role_title || "Cover letter"}</Text>
          {report.company && (
            <Text size="sm" c="dimmed">
              {report.company}
            </Text>
          )}
        </div>
        <CopyButton value={report.letter}>
          {({ copied, copy }) => (
            <Button size="compact-sm" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </Button>
          )}
        </CopyButton>
      </Group>

      <Textarea autosize minRows={12} maxRows={40} value={report.letter} readOnly />

      {report.sources.length > 0 && (
        <Group gap={6}>
          <Text size="xs" c="dimmed">
            Written from:
          </Text>
          {report.sources.map((source, index) => (
            <Badge key={index} size="xs" variant="outline">
              {source.source_type}: {source.source_label}
            </Badge>
          ))}
        </Group>
      )}
    </Stack>
  );
}
