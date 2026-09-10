import { cn } from "@/lib/cn";

/** Circular two-letter mark used by the nav and the footer. */
export function Monogram({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-8 items-center justify-center rounded-full border border-warm-border bg-warm-surface font-mono text-xs text-warm-black",
        className,
      )}
    >
      {children}
    </span>
  );
}
