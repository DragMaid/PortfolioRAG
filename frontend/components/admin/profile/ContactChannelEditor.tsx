"use client";

import { useId, useState } from "react";
import type { ContactChannelDto, ContactChannelInputDto } from "@/lib/api/generated";
import { ContactGlyph } from "@/components/icons";
import {
  CONTACT_SERVICE_NAMES,
  detectContactIcon,
  suggestChannelLabel,
} from "@/lib/contactChannels";
import { toChannelInput } from "@/lib/admin/useProfile";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Field, TextInput } from "../ui/Field";
import { PanelHeader } from "../ui/Panel";

type ContactChannelEditorProps = {
  channels: ContactChannelDto[];
  busy: boolean;
  onCreate: (input: ContactChannelInputDto) => Promise<void>;
  onUpdate: (id: number, input: ContactChannelInputDto) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onMove: (id: number, direction: -1 | 1) => Promise<void>;
};

/**
 * The links on the profile card and in the footer's network column.
 *
 * Paste an address and the service is recognised from it as you type, by the same function
 * the portfolio itself renders with — the API stores only the label and the address, so
 * there is nothing to save and no second opinion to disagree with.
 */
export function ContactChannelEditor({
  channels,
  busy,
  onCreate,
  onUpdate,
  onDelete,
  onMove,
}: ContactChannelEditorProps) {
  return (
    <div className="flex flex-col gap-4">
      <PanelHeader
        icon="link"
        title="Contact channels"
        description="However people should reach you. Any address works — the logo is recognised from it, and anything unrecognised gets a globe. The order here is the order the portfolio lists them in."
        aside={
          <span className="rounded border border-warm-border bg-warm-sunken px-2 py-0.5 font-mono text-[11px] font-medium text-warm-black">
            {channels.length} {channels.length === 1 ? "channel" : "channels"}
          </span>
        }
      />

      {channels.length > 0 ? (
        <ul className="divide-y divide-warm-border/60 overflow-hidden rounded border border-warm-border bg-warm-surface">
          {channels.map((channel, index) => (
            <li key={channel.id}>
              <ChannelRow
                channel={channel}
                busy={busy}
                isFirst={index === 0}
                isLast={index === channels.length - 1}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onMove={onMove}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon="link"
          title="No contact channels"
          description="The profile card shows only your email address until you add one."
        />
      )}

      <NewChannelForm busy={busy} onCreate={onCreate} />
    </div>
  );
}

function ChannelRow({
  channel,
  busy,
  isFirst,
  isLast,
  onUpdate,
  onDelete,
  onMove,
}: {
  channel: ContactChannelDto;
  busy: boolean;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (id: number, input: ContactChannelInputDto) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onMove: (id: number, direction: -1 | 1) => Promise<void>;
}) {
  const ids = useId();
  const [label, setLabel] = useState(channel.label ?? "");
  const [url, setUrl] = useState(channel.url ?? "");
  const [handle, setHandle] = useState(channel.handle ?? "");
  const [confirming, setConfirming] = useState(false);

  const id = channel.id;

  // Follows whatever is currently in the address box, saved or not — it is derived, so
  // there is no stored value for it to disagree with.
  const icon = detectContactIcon(url);

  const isDirty =
    label !== (channel.label ?? "") ||
    url !== (channel.url ?? "") ||
    handle !== (channel.handle ?? "");

  function save() {
    if (id === undefined || !isDirty || !label.trim() || !url.trim()) return;

    onUpdate(id, {
      ...toChannelInput(channel),
      label: label.trim(),
      url: url.trim(),
      handle: handle.trim() || undefined,
    });
  }

  return (
    <div className="flex flex-col gap-3 p-3 transition-colors hover:bg-warm-sunken/60 lg:flex-row lg:items-center">
      <div className="flex size-10 shrink-0 items-center justify-center rounded border border-warm-border bg-warm-sunken text-warm-black">
        <ContactGlyph name={icon} className="size-5" />
      </div>

      <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
        <Field label="Label" htmlFor={`${ids}-label`}>
          <TextInput
            id={`${ids}-label`}
            value={label}
            disabled={busy}
            maxLength={120}
            onChange={(event) => setLabel(event.target.value)}
            className="text-[12.5px]"
          />
        </Field>

        <Field label="Address" htmlFor={`${ids}-url`}>
          <TextInput
            id={`${ids}-url`}
            value={url}
            disabled={busy}
            maxLength={500}
            onChange={(event) => setUrl(event.target.value)}
            className="font-mono text-[11.5px]"
          />
        </Field>

        <Field label="Footer wording" htmlFor={`${ids}-handle`}>
          <TextInput
            id={`${ids}-handle`}
            value={handle}
            disabled={busy}
            maxLength={150}
            placeholder={label || "Optional"}
            onChange={(event) => setHandle(event.target.value)}
            className="text-[12.5px]"
          />
        </Field>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 self-end lg:self-auto">
        <Badge tone="outline">{CONTACT_SERVICE_NAMES[icon]}</Badge>

        <Button
          variant="ghost"
          icon="arrow-up"
          disabled={busy || isFirst}
          onClick={() => id !== undefined && void onMove(id, -1)}
          aria-label={`Move ${label} up`}
        />
        <Button
          variant="ghost"
          icon="arrow-down"
          disabled={busy || isLast}
          onClick={() => id !== undefined && void onMove(id, 1)}
          aria-label={`Move ${label} down`}
        />

        {confirming ? (
          <Button
            variant="danger"
            icon="trash"
            onClick={() => {
              if (id !== undefined) void onDelete(id);
              setConfirming(false);
            }}
            onBlur={() => setConfirming(false)}
            autoFocus
          >
            Confirm
          </Button>
        ) : (
          <Button
            variant="ghost"
            icon="trash"
            disabled={busy}
            onClick={() => setConfirming(true)}
            aria-label={`Remove ${label}`}
            className="hover:bg-warm-danger-bg hover:text-warm-danger"
          />
        )}

        <Button variant="primary" icon="save" disabled={busy || !isDirty} onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );
}

function NewChannelForm({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (input: ContactChannelInputDto) => Promise<void>;
}) {
  const ids = useId();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");

  const icon = detectContactIcon(url);
  const suggestion = suggestChannelLabel(url);
  const canAdd = url.trim().length > 0;

  async function add() {
    if (!canAdd) return;

    await onCreate({
      label: (label.trim() || suggestion || url).trim(),
      url: url.trim(),
      sortOrder: 0,
    });

    setUrl("");
    setLabel("");
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void add();
      }}
      className="flex flex-col gap-3 rounded border border-dashed border-warm-border bg-warm-sunken/40 p-3 sm:flex-row sm:items-end"
    >
      <div className="flex size-10 shrink-0 items-center justify-center self-start rounded border border-warm-border bg-warm-surface text-warm-black sm:self-auto sm:mb-0.5">
        <ContactGlyph name={icon} className="size-5" />
      </div>

      <Field
        label="Add a channel"
        htmlFor={`${ids}-url`}
        hint={
          canAdd
            ? `Recognised as ${CONTACT_SERVICE_NAMES[icon]}.`
            : "Paste a profile link, an email address or a phone number."
        }
        className="min-w-0 flex-1"
      >
        <TextInput
          id={`${ids}-url`}
          value={url}
          disabled={busy}
          maxLength={500}
          placeholder="https://github.com/your-handle"
          onChange={(event) => setUrl(event.target.value)}
          className="font-mono text-[11.5px]"
        />
      </Field>

      <Field label="Label" htmlFor={`${ids}-label`} className="min-w-0 flex-1">
        <TextInput
          id={`${ids}-label`}
          value={label}
          disabled={busy}
          maxLength={120}
          placeholder={suggestion || "github.com/your-handle"}
          onChange={(event) => setLabel(event.target.value)}
          className="text-[12.5px]"
        />
      </Field>

      <Button type="submit" variant="primary" icon="add" disabled={busy || !canAdd} className="shrink-0">
        Add
      </Button>
    </form>
  );
}
