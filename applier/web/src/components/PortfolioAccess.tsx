/**
 * Where retrieval asks, and what it asks under: the portfolio API's address and its token.
 *
 * Both belong to whoever is at the page, so both are set from here. The address defaults to
 * the deployed portfolio and can be pointed at one running locally; it lives in
 * `applier.yaml` like any other setting.
 *
 * The token does not. Retrieval runs under it, so nothing can be assessed without one — but
 * demanding it in the environment meant the controller could not start, and so could not show
 * this box, until it was already there. It is kept in the state directory with owner-only
 * permissions, never in `applier.yaml`, and never sent back here: all this is ever told is
 * whether there is one and where it came from.
 */

import { useState } from "react";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";

import { api } from "../api";
import type { Describe } from "../types";

const say = (error: unknown) => String((error as Error).message ?? error);

export function PortfolioAccess({ describe, onSaved }: { describe: Describe; onSaved: () => void }) {
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const { portfolio } = describe;
  const [address, setAddress] = useState(portfolio.api);
  const moved = address.trim().replace(/\/+$/, "") !== portfolio.api;

  const point = async () => {
    try {
      await api.config.profile({ portfolioApi: address });
      onSaved();
      notifications.show({ title: "Saved", message: `Retrieval now asks ${address.trim()}.` });
    } catch (error) {
      notifications.show({ color: "red", title: "Not saved", message: say(error) });
    }
  };

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
              Portfolio API
            </Text>
            <Text size="xs" c="dimmed">
              Where the fit report and the cover letter read your portfolio from, and the{" "}
              <code>pfl_…</code> token they read it under — the studio's access tab, write scope.
            </Text>
          </div>
          <Badge color={portfolio.tokenSet ? "green" : "orange"}>
            {portfolio.tokenSet ? `set · from the ${portfolio.tokenSource}` : "not set"}
          </Badge>
        </Group>

        <Group align="flex-end">
          <TextInput
            label="Address"
            description="The deployed portfolio by default. Point it at a local one to use that instead."
            placeholder="https://api.blograg.pbh-dev.tech"
            value={address}
            onChange={(event) => setAddress(event.currentTarget.value)}
            onKeyDown={(event) => event.key === "Enter" && moved && void point()}
            style={{ flex: 1 }}
          />
          <Button variant="default" disabled={!moved} onClick={() => void point()}>
            Point here
          </Button>
        </Group>

        <Divider />

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
