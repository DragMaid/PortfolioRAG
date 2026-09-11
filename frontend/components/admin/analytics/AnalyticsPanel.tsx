"use client";

import { useCallback, useEffect, useState } from "react";
import type { AnalyticsSummaryDto } from "@/lib/api/generated";
import { adminAnalyticsApi, describeError } from "@/lib/admin/client";
import { API_BASE_URL } from "@/lib/api/generated/client";
import { getAccessToken } from "@/lib/admin/session";
import { formatCount, formatDuration } from "@/lib/admin/format";
import { useToast } from "@/lib/admin/useToast";
import { cn } from "@/lib/cn";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Panel, PanelHeader } from "../ui/Panel";
import { StatusDot } from "../ui/StatusDot";
import { ReferrerTable } from "./ReferrerTable";
import { StatCard } from "./StatCard";
import { TopModules } from "./TopModules";
import { WeeklyChart } from "./WeeklyChart";

enum LoadState {
    Loading,
    Ready,
    Error
};

// TODO: probably should set a limit on the server side for max days
const WINDOWS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

export function AnalyticsPanel() {
  const { showToast } = useToast();

  const [days, setDays] = useState<number>(7);
  const [summary, setSummary] = useState<AnalyticsSummaryDto | null>(null);
  const [state, setState] = useState<LoadState>(LoadState.Loading);
  const [exporting, setExporting] = useState<boolean>(false);
  const [attempt, setAttempt] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await adminAnalyticsApi.adminAnalyticsGetSummary({ days });
        if (cancelled) return;

        setSummary(result);
        setState(LoadState.Ready);
      } catch (error) {
        if (cancelled) return;
        setState(LoadState.Error);
        showToast(await describeError(error, "Could not load analytics."), "error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [days, attempt, showToast]);

  /** Puts the panel back into its loading state and re-runs the effect above. */
  const reload = useCallback(() => {
    setState(LoadState.Loading);
    setAttempt((current) => current + 1);
  }, []);

  /**
   * Downloads the CSV.
   *
   * A plain link cannot do this: the endpoint needs a bearer token, and an anchor sends no
   * headers. So the file is fetched, turned into a blob and clicked synthetically.
   */
  const exportCsv = useCallback(async () => {
    setExporting(true);

    try {
      const token = await getAccessToken();
      // TODO: use a fetcher that support adding the token as headers inside
      const response = await fetch(`${API_BASE_URL}/api/admin/analytics/export?days=${days}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error(`The export failed (${response.status}).`);

      // Create a temporary blob link and programmatically download the file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `analytics-${days}d.csv`;
      anchor.click();

      // Freed on the next tick; revoking immediately can cancel the download
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("Export downloaded");
    } catch (error) {
      showToast(await describeError(error, "Could not export the CSV."), "error");
    } finally {
      setExporting(false);
    }
  }, [days, showToast]);

  const windowLabel = `Last ${days} days`;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-warm-border/60 pb-2">
        <div>
          <h1 className="font-serif text-2xl font-medium text-warm-black sm:text-3xl">
            Traffic & readership
          </h1>
          <p className="mt-0.5 text-[13.5px] text-warm-slate">
            Readership telemetry for your own projects, over a rolling window ending today.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <span className="flex items-center gap-1.5 rounded border border-warm-border bg-warm-surface px-2.5 py-1 text-warm-slate">
            <StatusDot pulse={false} />
            {windowLabel} (rolling)
          </span>

          <div
            role="group"
            aria-label="Analytics window"
            className="flex items-center gap-0.5 rounded border border-warm-border bg-warm-sunken p-0.5"
          >
            {WINDOWS.map((option) => (
              <button
                key={option.days}
                type="button"
                aria-pressed={days === option.days}
                onClick={() => {
                  if (option.days === days) return;
                  setDays(option.days);
                  setState(LoadState.Loading);
                }}
                className={cn(
                  "rounded px-2 py-1 transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-warm-accent",
                  days === option.days
                    ? "bg-warm-surface font-medium text-warm-black shadow-sm"
                    : "text-warm-slate hover:text-warm-black",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <Button icon="download" onClick={exportCsv} busy={exporting}>
            Export CSV
          </Button>
        </div>
      </header>

      {state === LoadState.Error ? (
        <Panel className="p-6">
          <EmptyState
            icon="error"
            title="Analytics unavailable"
            description="The readership figures could not be loaded."
            action={
              <Button icon="bar-chart" onClick={reload}>
                Try again
              </Button>
            }
          />
        </Panel>
      ) : state === LoadState.Loading || !summary ? (
        <AnalyticsSkeleton />
      ) : (
        <AnalyticsBody summary={summary} windowLabel={windowLabel} days={days} />
      )}
    </section>
  );
}

function AnalyticsBody({
  summary,
  windowLabel,
  days,
}: {
  summary: AnalyticsSummaryDto;
  windowLabel: string;
  days: number;
}) {
  const visitors = summary.uniqueVisitors;
  const reads = summary.reads;
  const dwell = summary.avgDwellSeconds;

  const topReferrer = summary.referrers?.[0];
  const perVisitor = (visitors?.value ?? 0) > 0 ? (reads?.value ?? 0) / (visitors?.value ?? 1) : 0;

  const hasReadings = (reads?.value ?? 0) > 0;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Unique visitors"
          icon="stats"
          value={formatCount(visitors?.value ?? 0)}
          change={visitors?.change}
          footnote={`vs ${formatCount(visitors?.previousValue ?? 0)} the window before`}
        />
        <StatCard
          label="Project reads"
          icon="stories"
          value={formatCount(reads?.value ?? 0)}
          change={reads?.change}
          footnote={`${perVisitor.toFixed(2)} reads per visitor`}
        />
        <StatCard
          label="Avg time on project"
          icon="schedule"
          value={formatDuration(dwell?.value ?? 0)}
          change={dwell?.change}
          footnote={
            (dwell?.value ?? 0) > 0
              ? `vs ${formatDuration(dwell?.previousValue ?? 0)} previously`
              : "No reading durations reported yet"
          }
        />
        <StatCard
          label="Top referrer"
          icon="hub"
          value={topReferrer?.host ?? (hasReadings ? "Direct" : "—")}
          footnote={
            topReferrer
              ? `${formatCount(topReferrer.uniqueVisitors ?? 0)} visitors from this source`
              : "Nothing inbound in this window"
          }
        />
      </div>

      <Panel className="flex flex-col gap-4 p-5 sm:p-6">
        <PanelHeader
          icon="stacked-chart"
          title="Daily readership & weekday baseline"
          description="Reads per day against the mean for that weekday over the four preceding weeks."
          aside={
            <div className="flex items-center gap-4 font-mono text-[11px]">
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-3 rounded-xs bg-warm-black" />
                <span className="text-warm-slate">This window</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-3 rounded-xs bg-warm-raised" />
                <span className="text-warm-slate">Baseline</span>
              </span>
            </div>
          }
        />

        {hasReadings ? (
          <WeeklyChart daily={summary.daily ?? []} />
        ) : (
          <EmptyState
            icon="bar-chart"
            title="No readings in this window"
            description={`Nothing was read in the last ${days} days. Published projects report a reading as soon as someone opens one.`}
          />
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <ReferrerTable referrers={summary.referrers ?? []} windowLabel={windowLabel} />
        </div>
        <div className="lg:col-span-5">
          <TopModules posts={summary.topPosts ?? []} />
        </div>
      </div>
    </>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((card) => (
          <div key={card} className="h-28 rounded border border-warm-border bg-warm-surface p-4">
            <div className="h-3 w-2/3 rounded bg-warm-sunken" />
            <div className="mt-4 h-6 w-1/2 rounded bg-warm-sunken" />
          </div>
        ))}
      </div>
      <div className="h-72 rounded border border-warm-border bg-warm-surface" />
    </div>
  );
}
