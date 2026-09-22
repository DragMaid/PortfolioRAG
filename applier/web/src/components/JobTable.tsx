/**
 * Every posting this run has touched, and what you can do about it.
 *
 * The actions are deliberately per-row rather than a batch: each one of these is an
 * application to a real employer, and there is no undo on the far side of a submit.
 *
 * *Show tab* is the one that makes the hand-off workable. Each posting that gets as far as a
 * form owns a tab in the board's own browser window, and the button brings that exact tab to
 * the front — so a table of eleven rows and a window of six tabs stay connected.
 */

import { ActionIcon, Anchor, Badge, Button, Group, Text, Tooltip } from "@mantine/core";
import {
  IconCheck,
  IconExternalLink,
  IconEye,
  IconRefresh,
  IconSend,
  IconX,
} from "@tabler/icons-react";
import { DataTable } from "mantine-datatable";

import type { Job } from "../types";
import { DONE } from "../types";
import { FitBadge } from "./FitBadge";
import { StateBadge } from "./StateBadge";

interface Props {
  jobs: Job[];
  busy: Set<string>;
  onOpen: (job: Job) => void;
  onApprove: (job: Job) => void;
  onSkip: (job: Job) => void;
  onFocus: (job: Job) => void;
  onSubmitted: (job: Job) => void;
  onRetry: (job: Job) => void;
}

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
  onFocus,
  onSubmitted,
  onRetry,
}: Props) {
  return (
    <DataTable
      withTableBorder
      borderRadius="md"
      striped
      highlightOnHover
      minHeight={220}
      noRecordsText="Nothing yet. Pick your searches and press Start."
      records={jobs}
      idAccessor="key"
      rowStyle={(job) => (job.historic ? { opacity: 0.55 } : undefined)}
      onRowClick={({ record }) => onOpen(record)}
      columns={[
        {
          accessor: "title",
          title: "Posting",
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
          render: (job) => (
            <FitBadge verdict={job.verdict} score={job.score} missingEssentials={job.missingEssentials} />
          ),
        },
        {
          accessor: "state",
          title: "State",
          width: 150,
          render: (job) => <StateBadge state={job.state} reason={job.reason} />,
        },
        {
          accessor: "updatedAt",
          title: "Age",
          width: 60,
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
              {job.tab && (
                <Tooltip label={job.tabOpen ? "Bring its tab to the front" : "Its tab is no longer open"}>
                  <ActionIcon
                    variant="default"
                    disabled={!job.tabOpen}
                    onClick={() => onFocus(job)}
                    aria-label="Show tab"
                  >
                    <IconEye size={16} />
                  </ActionIcon>
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

              {job.state === "awaiting_human" && (
                <Tooltip label="Record it as sent, and close its tab">
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
                <Tooltip label={job.state === "awaiting_human" ? "Discard it and close its tab" : "Pass on it"}>
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
  );
}
