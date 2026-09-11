"use client";

import { CompanyMark } from "@/components/experience/CompanyMark";
import { useRovingTabList } from "@/components/ui/useRovingTabList";
import { cn } from "@/lib/cn";
import type { ExperienceEntry } from "@/lib/types";

type ExperienceTimelineProps = {
  entries: ExperienceEntry[];
  activeIndex: number;
  onSelect: (index: number) => void;
  /** Id of the detail panel these tabs drive. */
  panelId: string;
};

/*
 * A 2px CSS `border-dotted` renders as a hairline at this scale, so the rule and
 * its connectors are drawn as an explicit dot pattern instead: a 3px dot every
 * 11px along the rule, every 8px down a stem.
 */
const DOT = "radial-gradient(circle, var(--color-warm-accent) 1.5px, transparent 1.6px)";

/** The horizontal rule the roles hang from. */
function DottedRule() {
  return (
    <div
      aria-hidden
      className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2"
      style={{
        backgroundImage: DOT,
        backgroundSize: "11px 3px",
        backgroundRepeat: "repeat-x",
        backgroundPosition: "center",
      }}
    />
  );
}

/** Dotted connector joining a node to the rule. */
function Stem() {
  return (
    <span
      aria-hidden
      className="h-5 w-[3px]"
      style={{
        backgroundImage: DOT,
        backgroundSize: "3px 8px",
        backgroundRepeat: "repeat-y",
        backgroundPosition: "center",
      }}
    />
  );
}

/** Desktop timeline: roles alternating above and below a dotted rule. */
export function ExperienceTimeline({
  entries,
  activeIndex,
  onSelect,
  panelId,
}: ExperienceTimelineProps) {
  const { registerRef, onKeyDown } = useRovingTabList(entries.length, onSelect);

  return (
    <div className="hidden md:block">
      <div
        role="tablist"
        aria-label="Career timeline"
        aria-orientation="horizontal"
        className="relative h-72"
      >
        <DottedRule />

        {entries.map((entry, index) => {
          const isActive = index === activeIndex;
          /* Roles alternate sides, so neighbouring labels never share a half
             and cannot collide however tight the horizontal spacing gets. */
          const isAbove = index % 2 === 0;

          const label = (
            <div className="text-center">
              <span className="whitespace-nowrap rounded border border-warm-border bg-warm-bg px-2 py-0.5 font-mono text-[11px] font-medium text-warm-black">
                {entry.period}
              </span>
              <div className="mt-1 font-serif text-xs italic text-warm-black">
                {entry.caption}
              </div>
            </div>
          );

          const node = (
            <button
              ref={registerRef(index)}
              type="button"
              role="tab"
              id={`${panelId}-tab-${entry.id}`}
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelect(index)}
              onMouseEnter={() => onSelect(index)}
              onFocus={() => onSelect(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "group flex size-14 items-center justify-center rounded-full border-2 p-3 shadow-md transition-all",
                "hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-warm-accent",
                isActive
                  ? "border-warm-black bg-warm-black text-warm-bg ring-4 ring-warm-accent/40"
                  : "border-warm-border bg-warm-surface hover:border-warm-black",
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center transition-transform group-hover:scale-105",
                  isActive ? "text-warm-bg" : "text-warm-black",
                )}
              >
                <CompanyMark company={entry.company} logoUrl={entry.logoUrl} />
              </span>
              <span className="sr-only">{entry.company}</span>
            </button>
          );

          return (
            <div
              key={entry.id}
              className={cn(
                "absolute flex w-40 -translate-x-1/2 flex-col items-center gap-2",
                isAbove ? "bottom-1/2" : "top-1/2",
              )}
              style={{ left: `${((index + 0.5) / entries.length) * 100}%` }}
            >
              {isAbove ? (
                <>
                  {label}
                  {node}
                  <Stem />
                </>
              ) : (
                <>
                  <Stem />
                  {node}
                  {label}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
