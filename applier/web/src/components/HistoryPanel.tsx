/**
 * The ledger, which is the real record: every posting this machine has ever looked at, and
 * what became of it, across every run.
 *
 * Beside it, the question digest — the employer questions no fact of yours answered, most
 * asked first. It is the most useful list here: one fact added for the question at the top
 * unblocks every application that was skipped for it.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { DataTable, type DataTableSortStatus } from "mantine-datatable";

import { api } from "../api";
import { fitRank, sortBy, useRemembered } from "../sorting";
import type { HistoryEntry, QuestionDigest } from "../types";
import { FitBadge } from "./FitBadge";
import { StateBadge } from "./StateBadge";
import type { JobState } from "../types";

const SORT_KEYS = {
  title: (entry: HistoryEntry) => (entry.title || entry.key).toLowerCase(),
  verdict: (entry: HistoryEntry) => fitRank(entry.verdict, entry.score),
  status: (entry: HistoryEntry) => entry.status,
  // ISO timestamps sort as text.
  updatedAt: (entry: HistoryEntry) => entry.updatedAt,
};

export function HistoryPanel({ onAddFact }: { onAddFact: () => void }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [questions, setQuestions] = useState<QuestionDigest[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useRemembered<DataTableSortStatus<HistoryEntry>>("history.sort", {
    columnAccessor: "updatedAt",
    direction: "desc",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [history, digest] = await Promise.all([api.history(status ?? undefined), api.questions()]);
      setEntries(history.entries);
      setCounts(history.counts);
      setQuestions(digest.questions);
      setError(null);
    } catch (cause) {
      setError(String((cause as Error).message ?? cause));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const wanted = search.trim().toLowerCase();
  const matching = wanted
    ? entries.filter((entry) =>
        `${entry.title} ${entry.company ?? ""} ${entry.reason ?? ""}`.toLowerCase().includes(wanted),
      )
    : entries;
  const shown = sortBy(matching, sort, SORT_KEYS);

  return (
    <Stack gap="md">
      <Group gap="xs">
        {Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => (
            <Badge
              key={name}
              variant={status === name ? "filled" : "light"}
              style={{ cursor: "pointer" }}
              onClick={() => setStatus(status === name ? null : name)}
            >
              {name}: {count}
            </Badge>
          ))}
        {Object.keys(counts).length === 0 && !loading && (
          <Text size="sm" c="dimmed">
            The ledger is empty. Nothing has been looked at on this machine yet.
          </Text>
        )}
      </Group>

      {error && (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      )}

      {questions.length > 0 && (
        <Card withBorder padding="md">
          <Group justify="space-between" mb="xs">
            <div>
              <Text fw={600}>Questions nothing answered</Text>
              <Text size="xs" c="dimmed">
                Most asked first. A fact for the one at the top unblocks the most applications.
              </Text>
            </div>
            <Button size="xs" onClick={onAddFact}>
              Add a fact
            </Button>
          </Group>
          <Stack gap={4}>
            {questions.slice(0, 12).map((one) => (
              <Group key={one.question} gap="xs" wrap="nowrap">
                <Badge size="sm" color={one.times > 2 ? "orange" : "gray"}>
                  {one.times}×
                </Badge>
                <Text size="sm">{one.question}</Text>
              </Group>
            ))}
          </Stack>
        </Card>
      )}

      <Group>
        <Select
          size="xs"
          placeholder="Any status"
          clearable
          value={status}
          onChange={setStatus}
          data={Object.keys(counts).sort()}
          w={200}
        />
        <TextInput
          size="xs"
          placeholder="Search titles, companies, reasons"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Button size="xs" onClick={() => void load()} loading={loading}>
          Refresh
        </Button>
      </Group>

      {loading && entries.length === 0 ? (
        <Loader size="sm" />
      ) : (
        <DataTable
          withTableBorder
          borderRadius="md"
          striped
          minHeight={200}
          noRecordsText="Nothing on record for that."
          records={shown}
          idAccessor="key"
          sortStatus={sort}
          onSortStatusChange={setSort}
          columns={[
            {
              accessor: "title",
              title: "Posting",
              sortable: true,
              render: (entry) => (
                <div>
                  <Anchor href={entry.url} target="_blank" rel="noreferrer" size="sm">
                    {entry.title || entry.key}
                  </Anchor>
                  <Text size="xs" c="dimmed">
                    {entry.company || "unknown company"}
                  </Text>
                </div>
              ),
            },
            {
              accessor: "verdict",
              title: "Fit",
              sortable: true,
              width: 130,
              render: (entry) => <FitBadge verdict={entry.verdict} score={entry.score} />,
            },
            {
              accessor: "status",
              title: "Status",
              sortable: true,
              width: 150,
              render: (entry) => (
                <StateBadge state={entry.status as JobState} reason={entry.reason} />
              ),
            },
            {
              accessor: "updatedAt",
              title: "When",
              sortable: true,
              width: 170,
              render: (entry) => (
                <Text size="xs" c="dimmed">
                  {entry.updatedAt.replace("T", " ").replace("+00:00", "")}
                </Text>
              ),
            },
          ]}
        />
      )}
    </Stack>
  );
}
