"use client";

import { useState } from "react";
import { ExperienceDetail } from "@/components/experience/ExperienceDetail";
import { ExperienceTimeline } from "@/components/experience/ExperienceTimeline";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { useRovingTabList } from "@/components/ui/useRovingTabList";
import { cn } from "@/lib/cn";
import type { ExperienceEntry } from "@/lib/types";

const PANEL_ID = "experience-panel";

export function ExperienceSection({ entries }: { entries: ExperienceEntry[] }) {
  /* Opens on the current role. */
  const [activeIndex, setActiveIndex] = useState(entries.length - 1);
  const mobileTabs = useRovingTabList(entries.length, setActiveIndex);

  if (entries.length === 0) return null;

  const active = entries[activeIndex] ?? entries[0];

  return (
    <section id="experience" className="scroll-mt-24">
      <SectionHeading
        eyebrow="02 / Experience"
        title="Career Trajectory & Systems Built"
        className="mb-12"
      />

      <SurfaceCard className="overflow-hidden p-6 sm:p-10">
        <ExperienceTimeline
          entries={entries}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
          panelId={PANEL_ID}
        />

        <ExperienceDetail
          entry={active}
          panelId={PANEL_ID}
          labelledBy={`${PANEL_ID}-tab-${active.id}`}
        />

        {/* The timeline needs horizontal room, so small screens get a plain
            selector driving the same panel. */}
        <div
          role="tablist"
          aria-label="Career timeline"
          className="mt-4 flex flex-wrap gap-2 md:hidden"
        >
          {entries.map((entry, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={entry.id}
                ref={mobileTabs.registerRef(index)}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={PANEL_ID}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveIndex(index)}
                onKeyDown={(event) => mobileTabs.onKeyDown(event, index)}
                className={cn(
                  "flex-1 basis-24 rounded-lg border p-2.5 text-center font-mono text-xs transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-accent",
                  isActive
                    ? "border-warm-black bg-warm-black font-medium text-warm-bg"
                    : "border-warm-border bg-warm-surface text-warm-black",
                )}
              >
                {entry.shortLabel}
              </button>
            );
          })}
        </div>
      </SurfaceCard>
    </section>
  );
}
