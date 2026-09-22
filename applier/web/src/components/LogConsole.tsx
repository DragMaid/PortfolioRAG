/**
 * The run's own log, as it happens.
 *
 * Kept because the interesting question during a run is rarely *what* a row is doing but
 * *why it is taking so long* — and the answer is almost always one line here: a model call,
 * a page that will not settle, a bot check being waited out.
 */

import { useEffect, useRef } from "react";
import { Card, Code, Group, ScrollArea, Switch, Text } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import type { LogLine } from "../types";

const time = (at: number) =>
  new Date(at * 1000).toLocaleTimeString(undefined, { hour12: false });

export function LogConsole({ log }: { log: LogLine[] }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useLocalStorage({ key: "applier.log.follow", defaultValue: true });

  useEffect(() => {
    if (follow) viewport.current?.scrollTo({ top: viewport.current.scrollHeight });
  }, [log, follow]);

  return (
    <Card withBorder padding="xs">
      <Group justify="space-between" mb="xs">
        <Text size="sm" fw={600}>
          Log
        </Text>
        <Switch
          size="xs"
          label="Follow"
          checked={follow}
          onChange={(event) => setFollow(event.currentTarget.checked)}
        />
      </Group>
      <ScrollArea h={200} viewportRef={viewport}>
        {log.length === 0 ? (
          <Text size="sm" c="dimmed">
            Nothing yet.
          </Text>
        ) : (
          log.map((line, index) => (
            <Code
              key={`${line.at}-${index}`}
              style={{ display: "block", background: "none", whiteSpace: "pre-wrap" }}
            >
              <Text span size="xs" c="dimmed" mr={6}>
                {time(line.at)}
              </Text>
              {line.line}
            </Code>
          ))
        )}
      </ScrollArea>
    </Card>
  );
}
