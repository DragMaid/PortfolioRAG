/**
 * A job-fit report, as the page shows it everywhere: in a row's drawer, and under a posting
 * pasted in by hand. One renderer, because they are the same report produced by the same
 * six stages — what a run decided on is exactly what you get from reading one yourself.
 *
 * Every claim carries its citation. The quotes are not decoration: a finding whose citation
 * a separate stage could not verify against the retrieved passages has already been demoted
 * before it reaches here, and seeing the passage is how you check that for yourself.
 */

import {
  Accordion,
  Alert,
  Badge,
  Blockquote,
  Card,
  Divider,
  Group,
  List,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { FitReport, Requirement } from "../types";
import { FitBadge } from "./FitBadge";

const STATUS: Record<Requirement["status"], { color: string; label: string }> = {
  met: { color: "green", label: "met" },
  partial: { color: "yellow", label: "partial" },
  missing: { color: "gray", label: "no evidence" },
};

export function ReportView({ report }: { report: FitReport }) {
  const counts = report.requirements.reduce<Record<string, number>>((into, requirement) => {
    into[requirement.status] = (into[requirement.status] ?? 0) + 1;
    return into;
  }, {});

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div>
          <Title order={4}>{report.role_title || "This posting"}</Title>
          {report.company && (
            <Text c="dimmed" size="sm">
              {report.company}
            </Text>
          )}
        </div>
        <FitBadge
          verdict={report.verdict}
          score={report.score}
          missingEssentials={report.requirements.filter((r) => r.is_essential && r.status === "missing").length}
        />
      </Group>

      <Text fw={500}>{report.headline}</Text>

      <Group gap="xs">
        {(["met", "partial", "missing"] as const).map((status) => (
          <Badge key={status} color={STATUS[status].color}>
            {counts[status] ?? 0} {STATUS[status].label}
          </Badge>
        ))}
      </Group>

      <Card withBorder padding="sm">
        <Markdown remarkPlugins={[remarkGfm]}>{report.summary}</Markdown>
      </Card>

      <Group align="flex-start" grow wrap="wrap">
        {report.strengths.length > 0 && (
          <Stack gap={4}>
            <Text fw={600} size="sm">
              Strengths
            </Text>
            <List size="sm" spacing={4}>
              {report.strengths.map((item) => (
                <List.Item key={item}>{item}</List.Item>
              ))}
            </List>
          </Stack>
        )}
        {report.gaps.length > 0 && (
          <Stack gap={4}>
            <Text fw={600} size="sm">
              Gaps
            </Text>
            <List size="sm" spacing={4}>
              {report.gaps.map((item) => (
                <List.Item key={item}>{item}</List.Item>
              ))}
            </List>
          </Stack>
        )}
      </Group>

      <Divider label="Requirements, one by one" labelPosition="left" />

      <Accordion variant="separated" multiple>
        {report.requirements.map((requirement, index) => (
          <Accordion.Item key={`${requirement.requirement}-${index}`} value={String(index)}>
            <Accordion.Control>
              <Group gap="xs" wrap="nowrap">
                <Badge color={STATUS[requirement.status].color} size="sm">
                  {STATUS[requirement.status].label}
                </Badge>
                {requirement.is_essential && (
                  <Badge size="sm" variant="outline" color="red">
                    essential
                  </Badge>
                )}
                <Text size="sm">{requirement.requirement}</Text>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                <Text size="sm" c="dimmed">
                  {requirement.rationale}
                </Text>
                {requirement.evidence.map((evidence, position) => (
                  <Blockquote key={position} p="sm" cite={`${evidence.source_type}: ${evidence.source_label}`}>
                    <Text size="sm">{evidence.quote}</Text>
                  </Blockquote>
                ))}
                {requirement.evidence.length === 0 && (
                  <Alert color="gray" variant="light">
                    Nothing in the portfolio evidences this. That is what “no evidence” means here — not
                    that you cannot do it, but that nothing published shows it.
                  </Alert>
                )}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>

      <Text size="xs" c="dimmed">
        {report.retrieval.passages_cited} of {report.retrieval.passages_considered} passages cited
        {report.retrieval.citations_rejected > 0 &&
          `, ${report.retrieval.citations_rejected} citation(s) rejected as unsupported`}
        {" · "}
        {report.usage.model} · {Math.round(report.usage.duration_ms / 1000)}s
      </Text>
    </Stack>
  );
}
