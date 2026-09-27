/**
 * Pairing the browser extension with this controller.
 *
 * The extension fills application forms in your own browser — the manual queue's, and any
 * other you point it at — from the same facts and remembered answers a run uses. It talks to
 * this server, and every request it makes carries this key, so no other page open in the
 * same browser can read your answers or your resume off 127.0.0.1.
 */

import { ActionIcon, Button, Card, CopyButton, Group, Text, TextInput, Tooltip } from "@mantine/core";
import { IconCheck, IconCopy, IconRefresh } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { api } from "../api";

export function ExtensionCard() {
  const [key, setKey] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    api.extension
      .key()
      .then((found) => setKey(found.key))
      .catch((error) => setProblem(String(error)));
  }, []);

  const rotate = () =>
    api.extension
      .rotate()
      .then((found) => setKey(found.key))
      .catch((error) => setProblem(String(error)));

  return (
    <Card withBorder padding="md">
      <Text fw={600}>Browser extension</Text>
      <Text size="xs" c="dimmed" mb="xs">
        Load <code>applier/extension/dist</code> as an unpacked extension in Chrome, then paste
        this address and key into its side panel.
      </Text>
      <Group gap="xs" align="flex-end" wrap="nowrap">
        <TextInput
          size="xs"
          label="Controller"
          readOnly
          value={window.location.origin}
          style={{ flex: 1 }}
        />
        <TextInput
          size="xs"
          label="Pairing key"
          readOnly
          value={key ?? ""}
          placeholder={problem ?? "…"}
          style={{ flex: 2 }}
          rightSection={
            key && (
              <CopyButton value={key}>
                {({ copied, copy }) => (
                  <ActionIcon size="sm" variant="subtle" onClick={copy} aria-label="Copy the key">
                    {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  </ActionIcon>
                )}
              </CopyButton>
            )
          }
        />
        <Tooltip label="Make a new key. The extension has to be paired again.">
          <Button size="xs" variant="default" leftSection={<IconRefresh size={14} />} onClick={rotate}>
            New key
          </Button>
        </Tooltip>
      </Group>
    </Card>
  );
}
