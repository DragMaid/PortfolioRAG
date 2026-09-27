/**
 * Every posting this run has touched, and what you can do about it.
 *
 * The actions are deliberately per-row rather than a batch: each one of these is an
 * application to a real employer, and there is no undo on the far side of a submit.
 *
 * *Open* is the manual queue's. It opens the posting's apply page in your own browser, where
 * the extension recognises it, fills the form from your facts and remembered answers, and
 * asks you in its side panel about anything it cannot. Nothing is sent until you send it.
 */

import { ActionIcon, Anchor, Badge, Button, Group, Text, Tooltip } from "@mantine/core";
import {
  IconCheck,
  IconExternalLink,
  IconForms,
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
  );
}
