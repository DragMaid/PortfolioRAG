"use client";

import { cn } from "@/lib/cn";
import { useToast, type ToastTone } from "@/lib/admin/useToast";
import { Icon, type IconName } from "./Icon";

const ICONS: Record<ToastTone, IconName> = {
  info: "check-circle",
  success: "check-circle",
  error: "error",
};

const ICON_TONES: Record<ToastTone, string> = {
  info: "text-warm-accent",
  success: "text-warm-accent",
  error: "text-[#e8a19b]",
};

/**
 * The floating confirmation in the bottom-right. One at a time, as in the prototype: these
 * report what just happened, and a stack of them is a log nobody asked for.
 */
export function ToastViewport() {
  const { toast, dismissToast } = useToast();

  return (
    <div
      // NOTE: polite rather than assertive. These narrate actions the author just took, so
      // interrupting whatever a screen reader is saying to repeat it back is not a kindness.
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed right-6 bottom-6 z-50 flex justify-end"
    >
      {toast ? (
        <button
          // Re-keyed per toast so an identical message replays the entry animation.
          key={toast.id}
          type="button"
          onClick={dismissToast}
          className={cn(
            "animate-fade-rise pointer-events-auto flex max-w-sm items-center gap-2 rounded",
            "border border-warm-black/20 bg-warm-black px-4 py-2.5 text-left shadow-elevated",
            "font-mono text-xs tracking-wide text-warm-surface",
          )}
        >
          <Icon name={ICONS[toast.tone]} className={cn("text-[17px]", ICON_TONES[toast.tone])} />
          <span>{toast.message}</span>
        </button>
      ) : null}
    </div>
  );
}
