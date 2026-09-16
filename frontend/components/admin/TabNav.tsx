"use client";

import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./ui/Icon";

export type StudioTab = "content" | "analytics" | "profile" | "access" | "intelligence";

const TABS: { key: StudioTab; icon: IconName; label: string }[] = [
  { key: "content", icon: "edit-note", label: "Projects & editor" },
  { key: "analytics", icon: "bar-chart", label: "Traffic & analytics" },
  { key: "profile", icon: "person", label: "Profile & presence" },
  { key: "access", icon: "hub", label: "Access & tokens" },
  { key: "intelligence", icon: "sparkle", label: "Intelligence" },
];

export function TabNav({
  active,
  onChange,
}: {
  active: StudioTab;
  onChange: (tab: StudioTab) => void;
}) {
  return (
    <nav className="sticky top-16 z-30 border-b border-warm-border bg-warm-surface/95">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <div role="tablist" aria-label="Studio sections" className="no-scrollbar -mx-4 flex items-center gap-1 overflow-x-auto px-4 pt-2 max-lg:mask-r-from-85% sm:mx-0 sm:gap-2 sm:px-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active === tab.key}
              onClick={() => onChange(tab.key)}
              className={cn(
                "flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors",
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
