"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";

/** What can be dropped in: plain text, read in the browser. Nothing is uploaded. */
const ACCEPTED_EXTENSIONS = [".txt", ".md", ".markdown"];
const ACCEPT_ATTRIBUTE = [...ACCEPTED_EXTENSIONS, "text/plain", "text/markdown"].join(",");

/** Far past any posting worth pasting; stops somebody dropping a log file into a textarea. */
const MAX_FILE_BYTES = 512 * 1024;

function isAccepted(file: File): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension));
}

/**
 * A job description field that is also a drop target.
 *
 * The textarea *is* the drop zone rather than sitting inside one, so there is one control to
 * focus, paste into and drop onto, and a dropped file simply becomes text the reader can
 * still edit before submitting.
 */
export function JobDescriptionDropzone({
  id,
  value,
  onChange,
  disabled,
  placeholder = "Paste the job description here, or drop a .txt or .md file.",
  className,
  footer,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Rendered under the field, beside the file button — a character count, usually. */
  footer?: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [loadedName, setLoadedName] = useState<string | null>(null);

  async function load(file: File | undefined) {
    if (!file) return;

    if (!isAccepted(file)) {
      setFileError(`${file.name} is not a .txt or .md file. Paste the text instead.`);
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setFileError(`${file.name} is too large to be a job description.`);
      return;
    }

    try {
      onChange((await file.text()).trim());
      setLoadedName(file.name);
      setFileError(null);
    } catch {
      setFileError(`${file.name} could not be read.`);
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative flex min-h-0 flex-1">
        <textarea
          id={id}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setLoadedName(null);
          }}
          disabled={disabled}
          placeholder={placeholder}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!disabled) void load(event.dataTransfer.files?.[0]);
          }}
          className={cn(
            "min-h-72 w-full flex-1 resize-y rounded-xl border bg-warm-bg px-4 py-3.5 text-[15px] leading-relaxed text-warm-black transition-colors",
            "placeholder:text-warm-slate/70 focus:border-warm-black focus:bg-warm-surface focus:outline-none disabled:opacity-60",
            /* Dashed only while a file is over it: the field is a drop target when that matters. */
            dragging
              ? "border-dashed border-warm-accent bg-warm-accent/10"
              : "border-warm-border hover:border-warm-accent",
          )}
        />

        {dragging ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl text-sm font-medium text-warm-black"
          >
            Drop to load the posting
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className="rounded-lg border border-warm-border bg-warm-surface px-3 py-1.5 text-[13px] text-warm-black transition-colors hover:border-warm-black disabled:opacity-50"
          >
            Choose a file
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            className="hidden"
            onChange={(event) => {
              void load(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          {loadedName ? (
            <span className="text-xs text-warm-slate">Loaded {loadedName}</span>
          ) : null}
        </div>
        {footer}
      </div>

      {fileError ? (
        <p role="alert" className="text-xs text-warm-danger">
          {fileError}
        </p>
      ) : null}
    </div>
  );
}
