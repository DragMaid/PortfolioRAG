/**
 * Choosing the resume file sent with applications — picked, not typed.
 *
 * The file goes to the controller, which keeps its own copy under the state directory and
 * points the config at that. No path to find, and nothing breaks when the original moves.
 */

import { Button, FileButton, Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconFileUpload, IconX } from "@tabler/icons-react";
import { useState } from "react";

import { api } from "../api";

const ACCEPT = ".pdf,.doc,.docx,.rtf,.txt";

export function ResumePicker({ current, onChanged }: { current: string | null; onChanged?: () => void }) {
  const [busy, setBusy] = useState(false);
  const name = current ? current.split(/[\\/]/).pop() : null;

  const act = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await work();
      notifications.show({ color: "green", message: done });
      onChanged?.();
    } catch (error) {
      notifications.show({ color: "red", title: "The resume was not changed", message: String(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Text size="sm" fw={500}>
        Resume file
      </Text>
      <Text size="xs" c="dimmed" mb={6}>
        Uploaded with each application, and by the extension. PDF, Word, RTF or text, up to 5 MB.
      </Text>
      <Group gap="xs">
        <FileButton
          accept={ACCEPT}
          onChange={(file) => file && void act(() => api.config.uploadResume(file), `Resume set: ${file.name}`)}
        >
          {(props) => (
            <Button {...props} size="xs" variant="default" loading={busy} leftSection={<IconFileUpload size={14} />}>
              {name ? "Choose another" : "Choose a file"}
            </Button>
          )}
        </FileButton>
        {name ? (
          <>
            <Text size="sm">{name}</Text>
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              leftSection={<IconX size={14} />}
              disabled={busy}
              onClick={() => void act(() => api.config.forgetResume(), "No resume file is sent now.")}
            >
              Remove
            </Button>
          </>
        ) : (
          <Text size="xs" c="dimmed">
            None — the board's own default goes instead.
          </Text>
        )}
      </Group>
    </div>
  );
}
