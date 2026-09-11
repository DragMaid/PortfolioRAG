import { cn } from "@/lib/cn";

/**
 * The pulsing dot beside a status line. The ping ring is decoration and is dropped under
 * the reduce-motion rule in globals.css, which leaves the solid dot behind.
 */
export function StatusDot({
  tone = "success",
  pulse = true,
}: {
  tone?: "success" | "accent" | "muted";
  pulse?: boolean;
}) {
  const colour =
    tone === "success" ? "bg-warm-success" : tone === "accent" ? "bg-warm-accent" : "bg-warm-slate";

  return (
    <span className="relative flex size-2">
      {pulse ? (
        <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-75", colour)} />
      ) : null}
      <span className={cn("relative inline-flex size-2 rounded-full", colour)} />
    </span>
  );
}
