"use client";

import { useId } from "react";
import type { MediaDto, PostDto } from "@/lib/api/generated";
import { MediaRole } from "@/lib/api/generated";
import type { Draft } from "@/lib/admin/useStudio";
import { formatDate } from "@/lib/admin/format";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Field, TextInput } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { Panel, PanelHeader } from "../ui/Panel";
import { Toggle } from "../ui/Toggle";
import { ArtworkSlot } from "./ArtworkSlot";
import { AssetManager } from "./AssetManager";
import { MarkdownEditor } from "./MarkdownEditor";

type DossierEditorProps = {
  post: PostDto | null;
  draft: Draft | null;
  /** Ordinary files the body embeds. The two leading slots are passed separately. */
  media: MediaDto[];
  thumbnail: MediaDto | null;
  trailer: MediaDto | null;
  /** What is still missing before this project can go live, if anything. */
  publishBlockers: string[];
  state: "idle" | "loading" | "ready" | "error";
  busy: null | "saving" | "publishing" | "creating";
  onChange: (patch: Partial<Draft>) => void;
  onUnpublish: () => void;
  onDelete: () => void;
  onUpload: (files: FileList | File[], role?: MediaRole) => Promise<void>;
  onCaptionChange: (mediaId: number, caption: string) => Promise<void>;
  onDeleteMedia: (mediaId: number) => Promise<void>;
  onCreate: () => void;
};

/** The right column: everything about the open project that the author can change. */
export function DossierEditor({
  post,
  draft,
  media,
  thumbnail,
  trailer,
  publishBlockers,
  state,
  busy,
  onChange,
  onUnpublish,
  onDelete,
  onUpload,
  onCaptionChange,
  onDeleteMedia,
  onCreate,
}: DossierEditorProps) {
  const ids = useId();

  if (state === "loading") return <EditorSkeleton />;

  if (state === "error") {
    return (
      <Panel className="p-6">
        <EmptyState
          icon="error"
          title="Could not open this project"
          description="Select another entry from the registry, or try again."
        />
      </Panel>
    );
  }

  if (state === "idle" || !post || !draft) {
    return (
      <Panel className="p-6">
        <EmptyState
          icon="edit-note"
          title="Nothing open"
          description="Pick a project from the registry, or start a new one."
          action={
            <Button icon="add" onClick={onCreate}>
              New entry
            </Button>
          }
        />
      </Panel>
    );
  }

  const locked = busy !== null;

  return (
    <Panel className="flex flex-col gap-5 p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-warm-border pb-4">
        <div className="min-w-0">
          <span className="mb-0.5 block font-mono text-[11px] font-semibold tracking-wider text-warm-accent uppercase">
            Dossier workspace
          </span>
          <h2 className="truncate font-serif text-2xl font-medium text-warm-black">
            {draft.title || "Untitled"}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-warm-slate">
            <Badge tone={post.isDraft ? "neutral" : "success"}>{post.isDraft ? "Draft" : "Live"}</Badge>
            <span>{post.viewCount ?? 0} lifetime reads</span>
            <span aria-hidden>•</span>
            <span>
              {post.isDraft
                ? `Created ${formatDate(post.createdAt)}`
                : `Published ${formatDate(post.publishedAt)}`}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/*
           * Not in the prototype, which only ever moved a project forwards. Both are on the
           * API and a studio with no way back out of publishing is a trap.
           */}
          {/* TODO(review): added beyond the prototype — unpublish and delete. */}
          {!post.isDraft ? (
            <Button icon="save" onClick={onUnpublish} busy={busy === "publishing"}>
              Unpublish
            </Button>
          ) : null}

          <Button
            variant="danger"
            icon="trash"
            onClick={onDelete}
            disabled={locked}
            title="Delete this project and its files"
          >
            Delete
          </Button>

          <Toggle
            id={`${ids}-hero`}
            label="Hero showcase"
            checked={draft.isFeatured}
            disabled={locked}
            onChange={(next) => onChange({ isFeatured: next })}
          />
        </div>
      </header>

      {/*
       * Said here, once, rather than left to be discovered by clicking a Publish button
       * that answers with an error toast. The API enforces the same rule; this only saves
       * the round trip.
       */}
      {post.isDraft && publishBlockers.length > 0 ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded border border-warm-accent/35 bg-warm-accent/10 px-3 py-2 font-mono text-[11.5px] leading-relaxed text-warm-black"
        >
          <Icon name="error" className="mt-px text-[14px] text-warm-accent" />
          <span>
            This project needs {publishBlockers.join(" and ")} before it can be published.
          </span>
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Project title" htmlFor={`${ids}-title`}>
          <TextInput
            id={`${ids}-title`}
            value={draft.title}
            disabled={locked}
            maxLength={200}
            onChange={(event) => onChange({ title: event.target.value })}
            className="font-serif text-base"
          />
        </Field>

        <Field label="Subheading / pitch" htmlFor={`${ids}-summary`}>
          <TextInput
            id={`${ids}-summary`}
            value={draft.summary}
            disabled={locked}
            maxLength={500}
            onChange={(event) => onChange({ summary: event.target.value })}
            className="text-[13.5px]"
          />
        </Field>
      </div>

      {/*
       * Not in the prototype, which never showed the slug. It is the project's public
       * address and the one field here that breaks existing links if it changes, so hiding
       * it while making it editable through the API would be the worse of the two options.
       */}
      {/* TODO(review): added beyond the prototype — the slug field. */}
      <Field
        label="Public slug"
        htmlFor={`${ids}-slug`}
        hint={`Reachable at /posts/${draft.slug || "…"} once published. Changing it breaks existing links.`}
      >
        <TextInput
          id={`${ids}-slug`}
          value={draft.slug}
          disabled={locked}
          maxLength={200}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          onChange={(event) => onChange({ slug: event.target.value })}
          className="font-mono text-xs"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          label="Category"
          htmlFor={`${ids}-category`}
          hint="The kicker beside the ordinal on the card."
        >
          <TextInput
            id={`${ids}-category`}
            value={draft.category}
            disabled={locked}
            maxLength={60}
            placeholder="VECTOR CORE"
            onChange={(event) => onChange({ category: event.target.value })}
            className="font-mono text-xs"
          />
        </Field>

        <Field label="Domain" htmlFor={`${ids}-domain`} hint="The line in the card footer.">
          <TextInput
            id={`${ids}-domain`}
            value={draft.domain}
            disabled={locked}
            maxLength={60}
            placeholder="Vector Storage"
            onChange={(event) => onChange({ domain: event.target.value })}
            className="font-mono text-xs"
          />
        </Field>
      </div>

      {/* The two files the project leads with, and the gate on publishing it. */}
      <div className="flex flex-col gap-4 border-t border-warm-border pt-5">
        <PanelHeader
          icon="image"
          title="Thumbnail & trailer"
          description="Both are required before this project can be published. Uploading replaces what is there."
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ArtworkSlot
            role={MediaRole.Thumbnail}
            media={thumbnail}
            isLive={!post.isDraft}
            disabled={locked}
            onUpload={onUpload}
          />
          <ArtworkSlot
            role={MediaRole.Trailer}
            media={trailer}
            isLive={!post.isDraft}
            disabled={locked}
            onUpload={onUpload}
          />
        </div>
      </div>

      <MarkdownEditor
        value={draft.body}
        disabled={locked}
        onChange={(body) => onChange({ body })}
      />

      {/* Where a reader is sent from the preview banner. All optional. */}
      <div className="flex flex-col gap-4 border-t border-warm-border pt-5">
        <PanelHeader
          icon="link"
          title="Project links"
          description="Each one drawn as a button on the preview banner. Left blank, the button is not drawn."
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {([
            ["repoUrl", "Repository", "https://github.com/you/project"],
            ["demoUrl", "Live demo", "https://project.example.com"],
            ["specUrl", "Write-up / RFC", "https://example.com/rfc"],
          ] as const).map(([key, label, placeholder]) => (
            <Field key={key} label={label} htmlFor={`${ids}-${key}`}>
              <TextInput
                id={`${ids}-${key}`}
                type="url"
                value={draft[key]}
                disabled={locked}
                maxLength={500}
                placeholder={placeholder}
                onChange={(event) => onChange({ [key]: event.target.value })}
                className="font-mono text-[11px]"
              />
            </Field>
          ))}
        </div>
      </div>

      {post.id !== undefined ? (
        <AssetManager
          postTitle={draft.title}
          media={media}
          disabled={locked}
          onUpload={onUpload}
          onCaptionChange={onCaptionChange}
          onDelete={onDeleteMedia}
        />
      ) : null}
    </Panel>
  );
}

function EditorSkeleton() {
  return (
    <Panel className="flex flex-col gap-5 p-6" aria-hidden>
      <div className="h-8 w-1/3 rounded bg-warm-sunken" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="h-16 rounded bg-warm-sunken" />
        <div className="h-16 rounded bg-warm-sunken" />
      </div>
      <div className="h-12 rounded bg-warm-sunken" />
      <div className="h-64 rounded bg-warm-sunken" />
    </Panel>
  );
}
