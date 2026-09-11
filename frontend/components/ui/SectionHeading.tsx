import { cn } from "@/lib/cn";

type SectionHeadingProps = {
  /** Ordinal + label, e.g. "01 / Profile Overview". */
  eyebrow: string;
  /** Serif heading. Omit for a rule-only header. */
  title?: string;
  /** Stretch the rule to fill the row instead of a fixed 3rem stub. */
  fullRule?: boolean;
  /** Trailing content aligned to the far end of the row. */
  action?: React.ReactNode;
  className?: string;
};

/** The numbered eyebrow + hairline that opens every section. */
export function SectionHeading({
  eyebrow,
  title,
  fullRule = false,
  action,
  className,
}: SectionHeadingProps) {
  const header = (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-warm-accent">
          {eyebrow}
        </span>
        <div className={cn("h-px bg-warm-border", fullRule ? "flex-1" : "w-12")} />
      </div>
      {title ? (
        <h2 className="font-serif text-3xl text-warm-black">{title}</h2>
      ) : null}
    </div>
  );

  if (!action) return <div className={className}>{header}</div>;

  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-4 sm:flex-row sm:items-end",
        className,
      )}
    >
      {header}
      {action}
    </div>
  );
}
