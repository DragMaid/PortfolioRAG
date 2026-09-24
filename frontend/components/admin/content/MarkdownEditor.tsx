"use client";

import { useState } from "react";
import { Markdown } from "@/components/markdown/Markdown";
import { cn } from "@/lib/cn";
import { Icon } from "../ui/Icon";

type Mode = "markdown" | "preview";

/**
 * The body editor: a plain textarea and a rendered preview behind two tabs.
 *
 * The preview is real react-markdown rather than the prototype's hand-written HTML twin,
 * so it cannot drift from what a reader actually gets.
 */
export function MarkdownEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("markdown");

  return (
    <div className="flex flex-col overflow-hidden rounded border border-warm-border">
      <div className="flex items-center justify-between gap-2 border-b border-warm-border bg-warm-sunken px-3 py-2">
        <div
          role="tablist"
          aria-label="Body editor mode"
          className="flex items-center gap-1 rounded border border-warm-border/50 bg-warm-raised/60 p-0.5"
        >
          <ModeTab
            active={mode === "markdown"}
            onClick={() => setMode("markdown")}
            icon="code"
            label="Markdown"
          />
          <ModeTab
            active={mode === "preview"}
            onClick={() => setMode("preview")}
            icon="eye"
            label="Preview"
          />
        </div>

        <span className="hidden text-[13px] text-warm-slate sm:inline">
          {value.length.toLocaleString("en-US")} characters
        </span>
      </div>

      {mode === "markdown" ? (
        <div className="bg-warm-surface p-3">
          <textarea
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            rows={16}
            spellCheck
            aria-label="Project body, in Markdown"
            className="w-full resize-y border-none bg-transparent p-0 font-mono text-[13.5px] leading-relaxed text-warm-black focus:outline-none disabled:cursor-not-allowed"
          />
        </div>
      ) : (
        <div className="bg-warm-surface p-5">
          {value.trim() ? (
            <div className="prose-studio">
              <Markdown>{value}</Markdown>
            </div>
          ) : (
            <p className="text-[13px] text-warm-slate">Nothing written yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: "code" | "eye";
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded px-2.5 py-1 text-[13px] transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-warm-accent",
        active
          ? "bg-warm-surface font-medium text-warm-black shadow-sm"
          : "text-warm-slate hover:text-warm-black",
      )}
    >
      <Icon name={icon} className="text-[14px]" />
      {label}
    </button>
  );
}
