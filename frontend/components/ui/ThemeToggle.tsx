"use client";

import { cn } from "@/lib/cn";
import { type ThemePreference, useThemePreference } from "@/lib/theme";

const NEXT: Record<ThemePreference, ThemePreference> = {
  light: "dark",
  dark: "light",
};

const LABELS: Record<ThemePreference, string> = {
  light: "Theme: light",
  dark: "Theme: dark",
};

/**
 * One button that steps through system → light → dark. The icon shows the current choice
 * rather than the next one, the way a status reads.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useThemePreference();
  const next = NEXT[preference];

  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={`${LABELS[preference]}. Switch to ${next}.`}
      title={`${LABELS[preference]} (switch to ${next})`}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-accent",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {preference === "light" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </>
        ) : preference === "dark" ? (
          <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
        ) : (
          <>
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8M12 16v4" />
          </>
        )}
      </svg>
    </button>
  );
}
