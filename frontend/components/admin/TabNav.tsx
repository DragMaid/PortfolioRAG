"use client";

import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./ui/Icon";

export type StudioTab = "content" | "analytics";

const TABS: { key: StudioTab; icon: IconName; label: string }[] = [
  { key: "content", icon: "edit-note", label: "01. Projects & editor" },
  { key: "analytics", icon: "bar-chart", label: "02. Traffic & analytics" },
];

export function TabNav({
  active,
  onChange,
}: {
  active: StudioTab;
  onChange: (tab: StudioTab) => void;
}) {
  return (
    <nav className="sticky top-16 z-30 border-b border-warm-border bg-warm-surface/50 backdrop-blur-sm">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <div role="tablist" aria-label="Studio sections" className="flex items-center gap-1 overflow-x-auto pt-3 sm:gap-4">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active === tab.key}
              onClick={() => onChange(tab.key)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-3 py-2.5 font-mono text-[12.5px] font-medium whitespace-nowrap transition-colors",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-warm-accent",
                active === tab.key
                  ? "border-warm-black text-warm-black"
                  : "border-transparent text-warm-slate hover:border-warm-border hover:text-warm-black",
              )}
            >
              <Icon name={tab.icon} className="text-[17px]" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
