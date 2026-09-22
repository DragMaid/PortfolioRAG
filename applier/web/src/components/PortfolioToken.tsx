/**
 * The portfolio API token, pasted rather than exported.
 *
 * Retrieval runs under it, so nothing can be assessed without one — but demanding it in the
 * environment meant the controller could not start, and so could not show this box, until it
 * was already there. It is kept in the state directory with owner-only permissions, never in
 * `applier.yaml`, and never sent back here: all this is ever told is whether there is one and
 * where it came from.
 */

import { useState } from "react";
import { Alert, Anchor, Badge, Button, Card, Group, PasswordInput, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";

import { api } from "../api";
import type { Describe } from "../types";

const say = (error: unknown) => String((error as Error).message ?? error);

export function PortfolioToken({ describe, onSaved }: { describe: Describe; onSaved: () => void }) {
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const { portfolio } = describe;

  const save = async () => {
    setSaving(true);
    try {
      await api.portfolio.set(token);
      setToken("");
      onSaved();
      notifications.show({ title: "Saved", message: "Retrieval will run under it from now on." });
    } catch (error) {
      notifications.show({ color: "red", title: "Not saved", message: say(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <div>
            <Text fw={600} size="sm">
              Portfolio API token
            </Text>
            <Text size="xs" c="dimmed">
              The <code>pfl_…</code> kind, from the studio's access tab, with the write scope.
              Retrieval runs under it — nothing can be assessed without one.
            </Text>
          </div>
          <Badge color={portfolio.tokenSet ? "green" : "orange"}>
            {portfolio.tokenSet ? `set · from the ${portfolio.tokenSource}` : "not set"}
          </Badge>
        </Group>

        <Group align="flex-end">
          <PasswordInput
            label={portfolio.tokenSet ? "Replace it" : "Paste it"}
            placeholder="pfl_…"
            value={token}
            onChange={(event) => setToken(event.currentTarget.value)}
            onKeyDown={(event) => event.key === "Enter" && token.trim() && void save()}
            style={{ flex: 1 }}
          />
          <Button variant="filled" loading={saving} disabled={!token.trim()} onClick={() => void save()}>
            Save
          </Button>
          {portfolio.tokenSource === "page" && (
            <Button
              variant="subtle"
              color="red"
              onClick={() => void api.portfolio.forget().then(onSaved)}
            >
              Forget
            </Button>
          )}
        </Group>

        <Text size="xs" c="dimmed">
          Kept in <code>{portfolio.storedAt}</code>, readable only by you, and never written into
          your config. You can export it as <code>{portfolio.tokenVariable}</code> instead — which
          is what <code>applier run</code> reads when nothing has been pasted.
        </Text>

        {!portfolio.tokenSet && (
          <Alert color="gray" variant="light">
            Everything else works without it: searching, reading a posting, filling a form. What
            needs it is the job-fit report and the cover letter, because both read your portfolio
            through{" "}
            <Anchor href={portfolio.api} target="_blank" rel="noreferrer" size="sm">
              {portfolio.api}
            </Anchor>
            .
          </Alert>
        )}
      </Stack>
    </Card>
  );
}
