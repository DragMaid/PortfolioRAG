"use client";

import { useEffect, useState } from "react";
import { adminAnalyticsApi } from "@/lib/admin/client";
import { formatCount, formatDuration } from "@/lib/admin/format";
import { Panel, PanelHeader } from "../ui/Panel";

/**
 * The glance card under the registry: two figures from the analytics tab, so the author
 * sees whether anything is happening without leaving the editor. Clicking either goes
 * there, as in the prototype.
 */
export function RegistrySummary({ onOpenAnalytics }: { onOpenAnalytics: () => void }) {
  const [figures, setFigures] = useState<{ reads: number; dwell: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        // Thirty days rather than seven: this is a background glance, and a week of a
        // portfolio's traffic is often a single-digit number that says nothing.
        const summary = await adminAnalyticsApi.adminAnalyticsGetSummary({ days: 30 });
        if (cancelled) return;

        setFigures({
          reads: summary.reads?.value ?? 0,
          dwell: summary.avgDwellSeconds?.value ?? 0,
        });
      } catch {
        // A glance card is not worth a toast. It simply shows nothing.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Panel className="flex flex-col gap-3 p-4">
      <PanelHeader
        title="Registry summary"
        aside={<span className="font-mono text-[11px] text-warm-slate">Last 30 days</span>}
      />

      <div className="grid grid-cols-2 gap-2">
        <SummaryTile
          value={figures ? formatCount(figures.reads) : "—"}
          label="Total reads"
          onClick={onOpenAnalytics}
        />
        <SummaryTile
          value={figures && figures.dwell > 0 ? formatDuration(figures.dwell) : "—"}
          label="Avg read time"
          onClick={onOpenAnalytics}
        />
      </div>
    </Panel>
  );
}

function SummaryTile({
  value,
  label,
  onClick,
}: {
  value: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-warm-border/50 bg-warm-sunken p-2 text-center transition-colors hover:bg-warm-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-accent"
    >
      <span className="block font-mono text-[18px] font-semibold text-warm-black">{value}</span>
      <span className="font-mono text-[10px] text-warm-slate">{label}</span>
    </button>
  );
}
