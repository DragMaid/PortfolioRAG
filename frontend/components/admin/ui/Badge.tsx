import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "success" | "outline";

const TONES: Record<Tone, string> = {
  neutral: "bg-warm-raised text-warm-slate",
  accent: "bg-warm-accent/20 text-warm-black",
  success: "bg-warm-success-bg text-warm-success",
  outline: "border border-warm-border bg-warm-surface text-warm-slate",
};

/** The small status chips: Live, Draft, Hero, a file extension. */
export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[9.5px] font-medium tracking-wide uppercase",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
