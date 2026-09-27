/**
 * Every posting this run has touched, and what you can do about it.
 *
 * The actions are deliberately per-row rather than a batch: each one of these is an
 * application to a real employer, and there is no undo on the far side of a submit.
 *
 * *Open* is the manual queue's. It opens the posting's apply page in your own browser, where
 * the extension recognises it, fills the form from your facts and remembered answers, and
 * asks you in its side panel about anything it cannot. Nothing is sent until you send it.
 *
 * Above it, filters — by where a posting has got to, its fit, its board, and words in it —
 * and every column but the actions sorts. Both are remembered in this browser.
 */

import { useMemo } from "react";
import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Group,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  IconCheck,
  IconExternalLink,
  IconFilterOff,
  IconForms,
  IconRefresh,
  IconSearch,
  IconSend,
  IconX,
} from "@tabler/icons-react";
import { DataTable, type DataTableSortStatus } from "mantine-datatable";

import { fitRank, sortBy, stateRank, useRemembered } from "../sorting";
import type { Job, JobState, Verdict } from "../types";
import { DONE, WAITING } from "../types";
import { FitBadge } from "./FitBadge";
import { StateBadge } from "./StateBadge";

interface Props {
  jobs: Job[];
  busy: Set<string>;
  onOpen: (job: Job) => void;
  onApprove: (job: Job) => void;
  onSkip: (job: Job) => void;
  onSubmitted: (job: Job) => void;
  onRetry: (job: Job) => void;
}

/** Where a posting has got to, in the groups the filter offers. */
type Stage = "all" | "you" | "moving" | "fits" | "done";

const STAGES: { value: Stage; label: string }[] = [
  { value: "all", label: "All" },
  { value: "you", label: "Waiting on you" },
  { value: "moving", label: "In progress" },
  { value: "fits", label: "Fits" },
  { value: "done", label: "Done" },
];

const FITS: ReadonlySet<JobState> = new Set<JobState>([
  "pending",
  "queued",
  "writing",
  "applying",
  "reviewing",
  "manual",
  "applied",
]);

const inStage = (job: Job, stage: Stage) => {
  switch (stage) {
    case "all":
      return true;
    case "you":
      return WAITING.has(job.state) || job.state === "needs_input";
    case "moving":
      return !WAITING.has(job.state) && !DONE.has(job.state);
    case "fits":
      // A pending row the limit held back was never assessed, so it is not a fit yet.
      return FITS.has(job.state) && job.verdict !== null;
    case "done":
      // A posting waiting on a fact is yours to unblock, so it counts under you, not here.
      return DONE.has(job.state) && job.state !== "needs_input";
  }
};

interface Filters {
  stage: Stage;
  text: string;
  verdicts: Verdict[];
  minScore: number | null;
  board: string | null;
  hideEarlier: boolean;
}

const NO_FILTERS: Filters = {
  stage: "all",
  text: "",
  verdicts: [],
  minScore: null,
  board: null,
  hideEarlier: false,
};

const DEFAULT_SORT: DataTableSortStatus<Job> = { columnAccessor: "state", direction: "asc" };

const SORT_KEYS = {
  title: (job: Job) => (job.title || job.key).toLowerCase(),
  verdict: (job: Job) => fitRank(job.verdict, job.score),
  // Waiting on you, then moving, then done; newest first within each, as the server orders it.
  state: (job: Job) => stateRank(job.state) * 1e12 - job.updatedAt,
  updatedAt: (job: Job) => job.updatedAt,
};

const ago = (at: number) => {
  const seconds = Math.max(0, Math.round(Date.now() / 1000 - at));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
};

export function JobTable({
  jobs,
  busy,
  onOpen,
  onApprove,
  onSkip,
  onSubmitted,
  onRetry,
}: Props) {
  const [filters, setFilters] = useRemembered<Filters>("run.filters", NO_FILTERS);
  const [sort, setSort] = useRemembered<DataTableSortStatus<Job>>("run.sort", DEFAULT_SORT);
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });

  const boards = useMemo(() => [...new Set(jobs.map((job) => job.board))].sort(), [jobs]);

  const counts = useMemo(() => {
    const tally = {} as Record<Stage, number>;
    for (const { value } of STAGES) tally[value] = jobs.filter((job) => inStage(job, value)).length;
    return tally;
  }, [jobs]);

  const shown = useMemo(() => {
    const words = filters.text.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const kept = jobs.filter((job) => {
      if (!inStage(job, filters.stage)) return false;
      if (filters.hideEarlier && job.historic) return false;
      if (filters.board && job.board !== filters.board) return false;
      if (filters.verdicts.length && (!job.verdict || !filters.verdicts.includes(job.verdict))) return false;
      if (filters.minScore != null && (job.score ?? -1) < filters.minScore) return false;
      if (words.length) {
        const haystack = `${job.title} ${job.company ?? ""} ${job.location ?? ""} ${job.reason ?? ""}`.toLowerCase();
        if (!words.every((word) => haystack.includes(word))) return false;
      }
      return true;
    });
    return sortBy(kept, sort, SORT_KEYS);
  }, [jobs, filters, sort]);

  const filtered =
    filters.stage !== NO_FILTERS.stage ||
    filters.text.trim() !== "" ||
    filters.verdicts.length > 0 ||
    filters.minScore != null ||
    filters.board != null ||
    filters.hideEarlier;

  return (
    <Stack gap="xs">
      <SegmentedControl
        size="xs"
        value={filters.stage}
        onChange={(value) => set({ stage: value as Stage })}
        data={STAGES.map(({ value, label }) => ({ value, label: `${label} · ${counts[value]}` }))}
      />
      <Group gap="xs" align="flex-end" wrap="wrap">
        <TextInput
          size="xs"
          style={{ flex: "1 1 200px" }}
          placeholder="Title, company, location or reason"
          leftSection={<IconSearch size={14} />}
          value={filters.text}
          onChange={(event) => set({ text: event.currentTarget.value })}
          aria-label="Search the table"
        />
        <MultiSelect
          size="xs"
          w={220}
          placeholder={filters.verdicts.length ? undefined : "Any fit"}
          data={[
            { value: "strong", label: "strong" },
            { value: "promising", label: "promising" },
            { value: "partial", label: "partial" },
            { value: "weak", label: "weak" },
          ]}
          value={filters.verdicts}
          onChange={(value) => set({ verdicts: value as Verdict[] })}
          clearable
          aria-label="Fit"
        />
        <NumberInput
          size="xs"
          w={110}
          placeholder="Min score"
          min={0}
          max={100}
          value={filters.minScore ?? ""}
          onChange={(value) => set({ minScore: value === "" ? null : Number(value) })}
          aria-label="Minimum score"
        />
        {boards.length > 1 && (
          <Select
            size="xs"
            w={140}
            placeholder="Any board"
            data={boards}
            value={filters.board}
            onChange={(value) => set({ board: value })}
            clearable
            aria-label="Board"
          />
        )}
        <Switch
          size="xs"
          label="Hide earlier runs"
          checked={filters.hideEarlier}
          onChange={(event) => set({ hideEarlier: event.currentTarget.checked })}
          mb={6}
        />
        {filtered && (
          <Button
            size="compact-xs"
            variant="subtle"
            leftSection={<IconFilterOff size={14} />}
            onClick={() => setFilters(NO_FILTERS)}
            mb={4}
          >
            Clear
          </Button>
        )}
      </Group>
      {filtered && (
        <Text size="xs" c="dimmed">
          Showing {shown.length} of {jobs.length}.
        </Text>
      )}

      <DataTable
        withTableBorder
        borderRadius="md"
        striped
        highlightOnHover
        minHeight={220}
        noRecordsText={
          jobs.length ? "Nothing matches these filters." : "Nothing yet. Pick your searches and press Start."
        }
        records={shown}
        sortStatus={sort}
        onSortStatusChange={setSort}
        idAccessor="key"
        rowStyle={(job) => (job.historic ? { opacity: 0.55 } : undefined)}
        onRowClick={({ record }) => onOpen(record)}
        columns={[
          {
            accessor: "title",
            title: "Posting",
            sortable: true,
            render: (job) => (
              <div>
                <Group gap={6} wrap="nowrap">
                  <Text size="sm" fw={500} lineClamp={1}>
                    {job.title || job.key}
                  </Text>
                  <Anchor
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    title="Open the posting in your own browser"
                  >
                    <IconExternalLink size={13} />
                  </Anchor>
                </Group>
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {job.company || "unknown company"}
                  {job.location ? ` · ${job.location}` : ""}
                  <Badge size="xs" variant="transparent" c="dimmed">
                    {job.board}
                  </Badge>
                </Text>
              </div>
            ),
          },
          {
            accessor: "verdict",
            title: "Fit",
            width: 150,
            sortable: true,
            render: (job) => (
              <FitBadge verdict={job.verdict} score={job.score} missingEssentials={job.missingEssentials} />
            ),
          },
          {
            accessor: "state",
            title: "State",
            width: 150,
            sortable: true,
            render: (job) => <StateBadge state={job.state} reason={job.reason} />,
          },
          {
            accessor: "updatedAt",
            title: "Age",
            width: 70,
            sortable: true,
            render: (job) => (
              <Text size="xs" c="dimmed">
                {ago(job.updatedAt)}
              </Text>
            ),
          },
          {
            accessor: "actions",
            title: "",
            width: 240,
            textAlign: "right",
            render: (job) => (
              <Group gap={6} justify="flex-end" wrap="nowrap" onClick={(event) => event.stopPropagation()}>
                {job.state === "manual" && (
                  <Tooltip
                    label={
                      job.external
                        ? "Open it in your browser, then its apply button — the extension follows it to the employer's form"
                        : "Open its application in your browser, where the extension fills it"
                    }
                  >
                    <Button
                      component="a"
                      href={job.applyUrl || job.url}
                      target="_blank"
                      rel="noreferrer"
                      size="compact-sm"
                      variant="filled"
                      leftSection={<IconForms size={14} />}
                    >
                      Open
                    </Button>
                  </Tooltip>
                )}

                {job.state === "pending" && (
                  <Button
                    size="compact-sm"
                    variant="filled"
                    loading={busy.has(job.key)}
                    onClick={() => onApprove(job)}
                  >
                    Apply
                  </Button>
                )}

                {job.state === "manual" && (
                  <Tooltip label="Record it as sent">
                    <Button
                      size="compact-sm"
                      color="green"
                      variant="filled"
                      leftSection={<IconSend size={14} />}
                      loading={busy.has(job.key)}
                      onClick={() => onSubmitted(job)}
                    >
                      I sent it
                    </Button>
                  </Tooltip>
                )}

                {(job.state === "needs_input" || job.state === "error") && (
                  <Tooltip label="Put it back in the queue">
                    <ActionIcon variant="default" onClick={() => onRetry(job)} aria-label="Retry">
                      <IconRefresh size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}

                {!DONE.has(job.state) && job.state !== "applied" && (
                  <Tooltip label="Pass on it">
                    <ActionIcon
                      variant="default"
                      color="red"
                      loading={busy.has(job.key)}
                      onClick={() => onSkip(job)}
                      aria-label="Skip"
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}

                {job.state === "applied" && <IconCheck size={16} color="var(--mantine-color-green-6)" />}
              </Group>
            ),
          },
        ]}
      />
    </Stack>
  );
}
