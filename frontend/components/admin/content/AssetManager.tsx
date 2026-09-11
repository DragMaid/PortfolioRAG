"use client";

import { useRef, useState, type DragEvent } from "react";
import type { MediaDto } from "@/lib/api/generated";
import { MediaExtension } from "@/lib/api/generated";
import { API_BASE_URL } from "@/lib/api/generated/client";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/admin/format";
import { useToast } from "@/lib/admin/useToast";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Icon, type IconName } from "../ui/Icon";
import { PanelHeader } from "../ui/Panel";

/** Which glyph and label a stored file gets, from the closed set the API accepts. */
const KINDS: Record<MediaExtension, { icon: IconName; label: string }> = {
  [MediaExtension.Png]: { icon: "image", label: "PNG" },
  [MediaExtension.Jpeg]: { icon: "image", label: "JPEG" },
  [MediaExtension.Gif]: { icon: "image", label: "GIF" },
  [MediaExtension.Webp]: { icon: "image", label: "WebP" },
  [MediaExtension.Mp4]: { icon: "video", label: "MP4" },
  [MediaExtension.Webm]: { icon: "video", label: "WebM" },
};

type AssetManagerProps = {
  postTitle: string;
  media: MediaDto[];
  onUpload: (files: FileList | File[]) => Promise<void>;
  onCaptionChange: (mediaId: number, caption: string) => Promise<void>;
  onDelete: (mediaId: number) => Promise<void>;
  disabled?: boolean;
};

/**
 * The files attached to the open project.
 *
 * Scoped to one post, as the prototype's later revision has it and as the API requires —
 * media only ever exists as part of a post.
 */
export function AssetManager({
  postTitle,
  media,
  onUpload,
  onCaptionChange,
  onDelete,
  disabled,
}: AssetManagerProps) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const totalBytes = media.reduce((sum, item) => sum + (item.byteSize ?? 0), 0);

  async function handleFiles(files: FileList | File[]) {
    setUploading(true);
    try {
      await onUpload(files);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);

    if (disabled || uploading) return;
    if (event.dataTransfer.files.length > 0) void handleFiles(event.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-4 border-t border-warm-border pt-5">
      <PanelHeader
        icon="folder-managed"
        title="Project media & file assets"
        description="Diagrams, captures and stills referenced from this project's body."
        aside={
          <span className="rounded border border-warm-border bg-warm-sunken px-2 py-0.5 font-mono text-[11px] font-medium text-warm-black">
            {media.length} {media.length === 1 ? "asset" : "assets"} • {formatBytes(totalBytes)}
          </span>
        }
      />

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "rounded border-2 border-dashed p-4 text-center transition-colors",
          dragging
            ? "border-warm-black bg-warm-sunken"
            : "border-warm-border bg-warm-sunken/50 hover:border-warm-black hover:bg-warm-sunken",
        )}
      >
        <input
          ref={input}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm"
          className="hidden"
          onChange={(event) => {
            if (event.target.files?.length) void handleFiles(event.target.files);
            // Reset so choosing the same file twice in a row still fires a change.
            event.target.value = "";
          }}
        />

        <div className="mb-1 flex items-center justify-center gap-2">
          <Icon
            name={uploading ? "spinner" : "upload"}
            className="text-[20px] text-warm-slate"
          />
          <span className="font-serif text-[15px] font-medium text-warm-black">
            {uploading ? "Uploading…" : `Upload media for ${postTitle || "this project"}`}
          </span>
        </div>

        <p className="font-mono text-[11px] text-warm-slate">
          Drag and drop images or video, or{" "}
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => input.current?.click()}
            className="font-medium text-warm-accent underline underline-offset-2 hover:text-warm-black disabled:cursor-not-allowed disabled:no-underline"
          >
            browse files
          </button>
          . Images are re-encoded and scaled on the way in.
        </p>
      </div>

      {media.length > 0 ? (
        <ul className="divide-y divide-warm-border/60 overflow-hidden rounded border border-warm-border bg-warm-surface">
          {media.map((item) => (
            <li key={item.id}>
              <AssetRow
                item={item}
                onCaptionChange={onCaptionChange}
                onDelete={onDelete}
                disabled={disabled}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded border border-dashed border-warm-border bg-warm-sunken/40 px-4 py-6 text-center font-mono text-[11px] text-warm-slate">
          No files attached to this project yet.
        </p>
      )}
    </div>
  );
}

function AssetRow({
  item,
  onCaptionChange,
  onDelete,
  disabled,
}: {
  item: MediaDto;
  onCaptionChange: (mediaId: number, caption: string) => Promise<void>;
  onDelete: (mediaId: number) => Promise<void>;
  disabled?: boolean;
}) {
  const { showToast } = useToast();
  const [caption, setCaption] = useState(item.caption ?? "");
  const [confirming, setConfirming] = useState(false);

  const kind = item.extension !== undefined ? KINDS[item.extension] : undefined;
  const contentUrl = item.url ? `${API_BASE_URL}${item.url}` : null;

  // The Markdown the author pastes into the body. The API's own content route, so it keeps
  // working when the signed storage link behind it expires.
  // TODO(review): the prototype copied a "{{asset:name}}" template token instead. Nothing
  // on the backend expands such a token, so this copies a real embed that renders as-is.
  const markdown = `![${caption || item.filename || "asset"}](${item.url ?? ""})`;

  async function copy(text: string, description: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied ${description}`);
    } catch {
      // Clipboard access is refused outside a secure context, and there is no fallback
      // worth the trouble — say so rather than silently doing nothing.
      showToast("Clipboard unavailable in this browser context", "error");
    }
  }

  return (
    <div className="flex flex-col gap-3 p-3 transition-colors hover:bg-warm-sunken/60 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded border border-warm-border bg-warm-sunken">
          <Icon name={kind?.icon ?? "image"} className="text-[20px] text-warm-accent" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-[12.5px] font-semibold text-warm-black">
              {item.filename}
            </span>
            {kind ? <Badge tone="outline">{kind.label}</Badge> : null}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-warm-slate">
            <span>{formatBytes(item.byteSize ?? 0)}</span>
            <span aria-hidden>•</span>
            <input
              value={caption}
              disabled={disabled}
              onChange={(event) => setCaption(event.target.value)}
              onBlur={() => {
                if (caption.trim() !== (item.caption ?? "").trim() && item.id !== undefined) {
                  void onCaptionChange(item.id, caption);
                }
              }}
              maxLength={200}
              placeholder="What is this for?"
              aria-label={`Caption for ${item.filename}`}
              className="min-w-40 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-warm-accent transition-colors placeholder:text-warm-slate/70 hover:border-warm-border focus:border-warm-black focus:bg-warm-surface focus:text-warm-black focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 self-end md:self-auto">
        <Button variant="ghost" icon="code" onClick={() => void copy(markdown, "Markdown embed")}>
          Copy embed
        </Button>

        {contentUrl ? (
          <Button icon="copy" onClick={() => void copy(contentUrl, "asset URL")}>
            Copy URL
          </Button>
        ) : null}

        {/* Two-step rather than a confirm() dialog: this deletes the file from the bucket. */}
        {confirming ? (
          <Button
            variant="danger"
            icon="trash"
            onClick={() => {
              if (item.id !== undefined) void onDelete(item.id);
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
            disabled={disabled}
            onClick={() => setConfirming(true)}
            aria-label={`Remove ${item.filename}`}
            className="hover:bg-warm-danger-bg hover:text-warm-danger"
          />
        )}
      </div>
    </div>
  );
}
