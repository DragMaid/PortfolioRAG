"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

/**
 * `primary` is the one committing action on a screen — Publish, Sign in. `default` is
 * everything reversible, `ghost` sits inside a panel where a border would be noise, and
 * `danger` is destructive.
 */
type Variant = "primary" | "default" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-warm-black text-warm-surface shadow-sm hover:bg-warm-black/88 disabled:hover:bg-warm-black",
  default:
    "border border-warm-border bg-warm-surface text-warm-black hover:bg-warm-sunken disabled:hover:bg-warm-surface",
  ghost: "text-warm-slate hover:bg-warm-sunken hover:text-warm-black",
  danger:
    "border border-warm-danger/25 bg-warm-danger-bg text-warm-danger hover:border-warm-danger/45 disabled:hover:border-warm-danger/25",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  icon?: IconName;
  /** Swaps the icon for a spinner and blocks the click, without changing the button's width. */
  busy?: boolean;
  children?: ReactNode;
};

export function Button({
  variant = "default",
  icon,
  busy = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const glyph = busy ? "spinner" : icon;

  return (
    <button
      type="button"
      // NOTE: a busy button is disabled as well as visually marked. Half the actions here
      // are not idempotent — publishing twice, uploading twice — and the spinner alone
      // would not stop a second click.
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded px-3 py-1.5 font-mono text-xs",
        "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-accent",
        "disabled:cursor-not-allowed disabled:opacity-55",
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {glyph ? <Icon name={glyph} className="text-[15px]" /> : null}
      {children}
    </button>
  );
}
