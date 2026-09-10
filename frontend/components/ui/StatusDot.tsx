import { cn } from "@/lib/cn";

type StatusDotProps = {
  /** `pulse` marks live availability; `muted` is a static bullet. */
  variant?: "pulse" | "solid" | "muted";
  className?: string;
};

/** Small circular availability indicator. */
export function StatusDot({ variant = "solid", className }: StatusDotProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        variant === "muted" ? "bg-warm-accent/40" : "bg-emerald-500",
        variant === "pulse" && "animate-pulse",
        className,
      )}
    />
  );
}
