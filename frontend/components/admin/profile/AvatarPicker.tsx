"use client";

import { useRef, useState, type DragEvent } from "react";
import type { AuthorDto } from "@/lib/api/generated";
import { apiUrl } from "@/lib/api/generated/client";
import { cn } from "@/lib/cn";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";

/**
 * The account's picture.
 *
 * Written straight through rather than held in the profile draft: it is a file, not a
 * field, and the API replaces it on its own endpoint.
 */
export function AvatarPicker({
  author,
  busy,
  onUpload,
  onRemove,
}: {
  author: AuthorDto | null;
  busy: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // The API answers with a path on itself; the bucket behind it is private.
  const avatarUrl = apiUrl(author?.avatarUrl);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);

    const file = event.dataTransfer.files[0];
    if (file && !busy) void onUpload(file);
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
        "flex flex-col items-center gap-3 rounded border-2 border-dashed p-5 text-center transition-colors",
        dragging ? "border-warm-black bg-warm-sunken" : "border-warm-border bg-warm-sunken/50",
      )}
    >
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onUpload(file);
          // Reset so choosing the same file twice in a row still fires a change.
          event.target.value = "";
        }}
      />

      <div className="relative size-28 overflow-hidden rounded-full border border-warm-border bg-warm-surface">
        {avatarUrl ? (
          /* Whatever host the media service redirects to — a plain <img>, like the
             portfolio's own avatar, rather than an entry in `images.remotePatterns`. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center">
            <Icon name="person" className="text-[40px] text-warm-slate/50" />
          </span>
        )}

        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center bg-warm-surface/70">
            <Icon name="spinner" className="text-[22px] text-warm-black" />
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button icon="upload" disabled={busy} onClick={() => input.current?.click()}>
          {avatarUrl ? "Replace" : "Upload"}
        </Button>

        {avatarUrl ? (
          <Button variant="ghost" icon="trash" disabled={busy} onClick={() => void onRemove()}>
            Remove
          </Button>
        ) : null}
      </div>

      <p className="font-mono text-[10.5px] leading-relaxed text-warm-slate">
        Drop a picture here, or browse. PNG, JPEG, GIF or WebP — it is scaled and
        re-encoded on the way in.
      </p>
    </div>
  );
}
