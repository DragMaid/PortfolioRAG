import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

/** The studio's one container: a bordered card on the page's warm ground. */
export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded border border-warm-border bg-warm-surface shadow-card",
        className,
      )}
    >
      {children}
    </section>
  );
}

/**
 * A panel's title row: an accent glyph, a small-caps mono label, and whatever the panel
 * wants on the right — a count, a filter, a link.
 */
export function PanelHeader({
  icon,
  title,
  description,
  aside,
  className,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon ? <Icon name={icon} className="text-[18px] text-warm-accent" /> : null}
          <h2 className="font-mono text-xs font-semibold tracking-wider text-warm-black uppercase">
            {title}
          </h2>
        </div>
        {description ? (
          <p className="mt-1 text-[12.5px] leading-relaxed text-warm-slate">{description}</p>
        ) : null}
      </div>
      {aside ? <div className="flex shrink-0 items-center gap-2">{aside}</div> : null}
    </div>
  );
}
