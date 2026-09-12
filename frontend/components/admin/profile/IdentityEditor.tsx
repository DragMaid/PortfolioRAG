"use client";

import { useId } from "react";
import type { ProfileDraft } from "@/lib/admin/useProfile";
import { Field, TextArea, TextInput } from "../ui/Field";
import { PanelHeader } from "../ui/Panel";
import { MarkdownEditor } from "../content/MarkdownEditor";

type IdentityEditorProps = {
  draft: ProfileDraft;
  disabled: boolean;
  onChange: (patch: Partial<ProfileDraft>) => void;
};

/**
 * Every line of copy the landing page prints about the author, grouped by where it lands
 * rather than by type — the hints say which part of the page each one shows up on, because
 * "Focus" means nothing on its own.
 */
export function IdentityEditor({ draft, disabled, onChange }: IdentityEditorProps) {
  const ids = useId();

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Name" htmlFor={`${ids}-name`} hint="Also sets the monogram and the nav handle.">
          <TextInput
            id={`${ids}-name`}
            value={draft.name}
            disabled={disabled}
            maxLength={100}
            onChange={(event) => onChange({ name: event.target.value })}
            className="font-serif text-base"
          />
        </Field>

        <Field
          label="Title"
          htmlFor={`${ids}-title`}
          hint="The line under your name on the profile card."
        >
          <TextInput
            id={`${ids}-title`}
            value={draft.title}
            disabled={disabled}
            maxLength={150}
            placeholder="Staff Systems & Distributed Infrastructure"
            onChange={(event) => onChange({ title: event.target.value })}
            className="text-[13.5px]"
          />
        </Field>
      </div>

      <Field
        label="Public handle"
        htmlFor={`${ids}-handle`}
        hint={`Your portfolio is published at /${draft.handle || "…"}. Changing it breaks the old link.`}
      >
        <TextInput
          id={`${ids}-handle`}
          value={draft.handle}
          disabled={disabled}
          maxLength={60}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          placeholder="ada-lovelace"
          onChange={(event) => onChange({ handle: event.target.value })}
          className="font-mono text-xs"
        />
      </Field>

      <Field
        label="Email"
        htmlFor={`${ids}-email`}
        hint="Your sign-in address, and the one the contact call-out writes to. Changing it means confirming it again."
      >
        <TextInput
          id={`${ids}-email`}
          type="email"
          value={draft.email}
          disabled={disabled}
          maxLength={256}
          onChange={(event) => onChange({ email: event.target.value })}
          className="font-mono text-xs"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          label="Location"
          htmlFor={`${ids}-location`}
          hint="Beside the pin on the profile card, and in the colophon."
        >
          <TextInput
            id={`${ids}-location`}
            value={draft.location}
            disabled={disabled}
            maxLength={120}
            placeholder="San Francisco, CA (Hybrid)"
            onChange={(event) => onChange({ location: event.target.value })}
            className="text-[13.5px]"
          />
        </Field>

        <Field
          label="Availability"
          htmlFor={`${ids}-availability`}
          hint="Beside the pulsing dot, on the card and in the footer."
        >
          <TextInput
            id={`${ids}-availability`}
            value={draft.availability}
            disabled={disabled}
            maxLength={160}
            placeholder="Open for Staff roles & select advisory"
            onChange={(event) => onChange({ availability: event.target.value })}
            className="text-[13.5px]"
          />
        </Field>

      </div>

      <Field
        label="Focus note"
        htmlFor={`${ids}-focus`}
        hint="The line along the bottom of the profile card."
      >
        <TextInput
          id={`${ids}-focus`}
          value={draft.focus}
          disabled={disabled}
          maxLength={160}
          placeholder="Primary focus: Systems / C++ / Rust"
          onChange={(event) => onChange({ focus: event.target.value })}
          className="text-[13.5px]"
        />
      </Field>

      <div className="flex flex-col gap-4 border-t border-warm-border pt-5">
        <PanelHeader
          icon="stories"
          title="Narrative"
          description="The long-form copy: the statement at the top of the biography card, the biography itself, and the two short pieces the footer prints."
        />

        <Field
          label="Headline"
          htmlFor={`${ids}-headline`}
          hint="The large serif statement above your biography."
        >
          <TextArea
            id={`${ids}-headline`}
            value={draft.headline}
            disabled={disabled}
            maxLength={400}
            rows={2}
            placeholder="Designing high-throughput computing engines, fault-tolerant protocols, and quiet, tactile digital interfaces."
            onChange={(event) => onChange({ headline: event.target.value })}
            className="font-serif text-[15px]"
          />
        </Field>

        <Field label="Biography" hint="Markdown. Rendered on the landing page exactly as it previews here.">
          <MarkdownEditor
            value={draft.biography}
            disabled={disabled}
            onChange={(biography) => onChange({ biography })}
          />
        </Field>

        <Field
          label="Footer biography"
          htmlFor={`${ids}-footer-bio`}
          hint="The short paragraph in the footer's first column. Plain text."
        >
          <TextArea
            id={`${ids}-footer-bio`}
            value={draft.footerBio}
            disabled={disabled}
            maxLength={500}
            onChange={(event) => onChange({ footerBio: event.target.value })}
            className="text-[13px]"
          />
        </Field>

        <Field
          label="Contact pitch"
          htmlFor={`${ids}-pitch`}
          hint={'The copy under "Initiate a conversation", above the footer.'}
        >
          <TextArea
            id={`${ids}-pitch`}
            value={draft.contactPitch}
            disabled={disabled}
            maxLength={500}
            onChange={(event) => onChange({ contactPitch: event.target.value })}
            className="text-[13px]"
          />
        </Field>
      </div>
    </div>
  );
}
