"use client";

import { useRef, useState, type DragEvent } from "react";
import type { MediaDto } from "@/lib/api/generated";
import { MediaExtension, MediaRole } from "@/lib/api/generated";
import { API_BASE_URL } from "@/lib/api/generated/client";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/admin/format";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";

/** Images only for a thumbnail; a trailer takes either. Mirrors what the API accepts. */
const IMAGE_TYPES = "image/png,image/jpeg,image/gif,image/webp";
const VIDEO_TYPES = "video/mp4,video/webm";

function isVideo(media: MediaDto): boolean {
  return media.extension === MediaExtension.Mp4 || media.extension === MediaExtension.Webm;
}

type ArtworkSlotProps = {
  /* The two singular slots only. `MediaRole` is a const object rather than a TS enum, so
     the member types are spelled this way. */
  role: typeof MediaRole.Thumbnail | typeof MediaRole.Trailer;
  media: MediaDto | null;
  /** True once the project is live, when the API refuses to let either slot be emptied. */
  isLive: boolean;
  disabled?: boolean;
  onUpload: (files: FileList | File[], role: MediaRole) => Promise<void>;
};

/**
 * One of the two files a project must have before it can be published.
 *
 * Given its own control rather than being left to the general asset list: both are
 * required, only one of each is kept, and uploading replaces rather than adds — none of
 * which a drop zone that says "drag files here" would convey.
 */
export function ArtworkSlot({ role, media, isLive, disabled, onUpload }: ArtworkSlotProps) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const isThumbnail = role === MediaRole.Thumbnail;
  const label = isThumbnail ? "Thumbnail" : "Trailer";
  const accept = isThumbnail ? IMAGE_TYPES : `${IMAGE_TYPES},${VIDEO_TYPES}`;

  const description = isThumbnail
    ? "The still on the project card. Pictures only."
    : "Plays in the preview banner. A video, or a second picture if there is no footage.";

  const contentUrl = media?.url ? `${API_BASE_URL}${media.url}` : null;

  async function handleFiles(files: FileList | File[]) {
    setBusy(true);
    try {
      await onUpload(files, role);
    } finally {
      setBusy(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);

    if (disabled || busy) return;
    if (event.dataTransfer.files.length > 0) void handleFiles(event.dataTransfer.files);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col gap-3 rounded border p-3 transition-colors",
        dragging
          ? "border-warm-black bg-warm-sunken"
          : media
            ? "border-warm-border bg-warm-surface"
            : "border-dashed border-warm-danger/40 bg-warm-danger-bg/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] tracking-wider text-warm-slate uppercase">
              {label}
            </span>
            {media ? (
              <Badge tone="success">Set</Badge>
            ) : (
              <Badge tone="neutral">Required</Badge>
            )}
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-warm-slate">{description}</p>
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) void handleFiles(event.target.files);
          // Reset so choosing the same file twice in a row still fires a change.
          event.target.value = "";
        }}
      />

      {/* The stored file itself, so the author can see what a reader will. */}
      <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded border border-warm-border bg-warm-sunken">
        {media && contentUrl ? (
          isVideo(media) ? (
            <video
              key={contentUrl}
              src={contentUrl}
              controls
              muted
              playsInline
              preload="metadata"
              className="size-full object-cover"
            />
          ) : (
            /* The API redirects to a signed link that expires, which the Next image
               optimizer would cache past its deadline and then serve as broken. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={contentUrl}
              src={contentUrl}
              alt={media.caption || `${label} for this project`}
              className="size-full object-cover"
            />
          )
        ) : (
          <span className="flex flex-col items-center gap-1 font-mono text-[11px] text-warm-slate">
            <Icon name={busy ? "spinner" : "image"} className="text-[22px]" />
            {busy ? "Uploading…" : "Nothing set"}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="truncate font-mono text-[10.5px] text-warm-slate">
          {media ? `${media.filename} • ${formatBytes(media.byteSize ?? 0)}` : "No file yet"}
        </span>

        <Button
          icon="upload"
          busy={busy}
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          {media ? "Replace" : `Add ${label.toLowerCase()}`}
        </Button>
      </div>

      {/*
       * No delete. The API refuses to empty either slot on a published project — it would
       * leave a live page with a hole in it — and on a draft the only thing worth doing is
       * replacing, which Replace already does.
       */}
      {isLive && media ? (
        <p className="font-mono text-[10.5px] text-warm-slate">
          Live: replacing swaps it immediately. Unpublish first to remove it altogether.
        </p>
      ) : null}
    </div>
  );
}
