"use client";

import { cn } from "@/lib/cn";

/** The Hero Showcase switch. A real button with `aria-pressed`, not a styled checkbox. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded border border-warm-border bg-warm-sunken px-3 py-1.5">
      <label
        htmlFor={id}
        className="cursor-pointer font-mono text-[11px] tracking-wide text-warm-slate uppercase select-none"
      >
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative flex h-5 w-10 shrink-0 items-center rounded-full transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-accent",
          "disabled:cursor-not-allowed disabled:opacity-60",
          checked ? "bg-warm-black" : "bg-warm-slate/40",
        )}
      >
        <span
          className={cn(
            "size-4 rounded-full bg-warm-surface shadow-sm transition-transform",
            checked ? "translate-x-5" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}
