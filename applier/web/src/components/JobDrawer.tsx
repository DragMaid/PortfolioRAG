/**
 * One posting, in full: how it got here, what the analysis found, and what would be sent.
 *
 * This is what picking is supposed to be done on. A verdict and a score in a table row are a
 * summary of the report below, and the report is a summary of the passages it cites — so the
 * drawer goes all the way down to the quotes, and the letter is here in full rather than
 * described.
 */

import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  CopyButton,
  Drawer,
  Group,
  Loader,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
} from "@mantine/core";

import { api } from "../api";
import type { Job, JobDetail } from "../types";
import { ReportView } from "./ReportView";
import { StageTrail } from "./StageTrail";
import { StateBadge } from "./StateBadge";

interface Props {
  job: Job | null;
  onClose: () => void;
}

export function JobDrawer({ job, onClose }: Props) {
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!job) return;
    let current = true;
    setDetail(null);
    setError(null);

    api
      .job(job.key)
      .then((found) => current && setDetail(found))
      .catch((cause) => current && setError(String(cause.message ?? cause)));

    return () => {
      current = false;
    };
    // Re-read when the row changes state: the letter and the answers appear as it goes.
  }, [job?.key, job?.state]);

  const answers = Object.entries(detail?.answers ?? {});

  return (
    <Drawer
      opened={job !== null}
      onClose={onClose}
      position="right"
      size="xl"
      title={
        job && (
          <Group gap="xs">
            <Text fw={600}>{job.title || job.key}</Text>
            <StateBadge state={job.state} reason={job.reason} assessed={job.hasReport} />
          </Group>
        )
      }
    >
      {job && (
        <Stack gap="md">
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              {job.company || "unknown company"}
            </Text>
            <Badge size="sm" variant="outline">
              {job.board}
            </Badge>
            <Button
              size="compact-xs"
              component="a"
              href={job.url}
              target="_blank"
              rel="noreferrer"
            >
              Open the posting
            </Button>
          </Group>

          {job.reason && (
            <Alert variant="light" color="gray">
              {job.reason}
            </Alert>
          )}

          {error && (
            <Alert variant="light" color="red">
              {error}
            </Alert>
          )}

          <Tabs defaultValue="report">
            <Tabs.List>
              <Tabs.Tab value="report">Report</Tabs.Tab>
              <Tabs.Tab value="letter">Cover letter</Tabs.Tab>
              <Tabs.Tab value="answers">Answers {answers.length > 0 && `(${answers.length})`}</Tabs.Tab>
              <Tabs.Tab value="trail">Trail</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="report" pt="md">
              {!detail && !error && <Loader size="sm" />}
              {detail?.report ? (
                <ReportView report={detail.report} />
              ) : (
                detail && (
                  <Text c="dimmed" size="sm">
                    It has not been assessed yet.
                  </Text>
                )
              )}
            </Tabs.Panel>

            <Tabs.Panel value="letter" pt="md">
              {detail?.letter ? (
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      Written from your portfolio, citing the same passages as the report.
                    </Text>
                    <CopyButton value={detail.letter}>
                      {({ copied, copy }) => (
                        <Button size="compact-xs" onClick={copy}>
                          {copied ? "Copied" : "Copy"}
                        </Button>
                      )}
                    </CopyButton>
                  </Group>
                  <Textarea autosize minRows={10} maxRows={30} value={detail.letter} readOnly />
                </Stack>
              ) : (
                <Text c="dimmed" size="sm">
                  No letter yet — one is written when a posting is picked, not when it is assessed.
                </Text>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="answers" pt="md">
              {answers.length > 0 ? (
                <Table withTableBorder striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Question</Table.Th>
                      <Table.Th>Answered</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {answers.map(([question, answer]) => (
                      <Table.Tr key={question}>
                        <Table.Td>{question}</Table.Td>
                        <Table.Td>{Array.isArray(answer) ? answer.join(", ") : String(answer)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : (
                <Text c="dimmed" size="sm">
                  {job.questions.length > 0
                    ? "None — these are the questions no fact of yours answered:"
                    : "No employer questions on this one, or the form has not been reached yet."}
                </Text>
              )}
              {job.questions.length > 0 && (
                <Stack gap={4} mt="sm">
                  {job.questions.map((question) => (
                    <Badge key={question} color="yellow" variant="light" style={{ textTransform: "none" }}>
                      {question}
                    </Badge>
                  ))}
                </Stack>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="trail" pt="md">
              <StageTrail stages={job.stages} />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      )}
    </Drawer>
  );
}
