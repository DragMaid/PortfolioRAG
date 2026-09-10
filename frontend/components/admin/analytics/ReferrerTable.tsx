import type { ReferrerDto } from "@/lib/api/generated";
import { formatCount, formatDuration, formatShare } from "@/lib/admin/format";
import { EmptyState } from "../ui/EmptyState";
import { Panel, PanelHeader } from "../ui/Panel";

/**
 * A brand colour for the handful of sources worth recognising at a glance, and the warm
 * accent for everything else. Not a categorical scale: these are identities, not series.
 */
const HOST_COLOURS: Record<string, string> = {
  "news.ycombinator.com": "#ff6600",
  "github.com": "var(--color-warm-black)",
  "x.com": "#1da1f2",
  "twitter.com": "#1da1f2",
  "reddit.com": "#ff4500",
  "linkedin.com": "#0a66c2",
};

export function ReferrerTable({
  referrers,
  windowLabel,
}: {
  referrers: ReferrerDto[];
  windowLabel: string;
}) {
  return (
    <Panel className="flex flex-col gap-4 p-5">
      <PanelHeader
        icon="share"
        title="Distribution by channel & inbound source"
        aside={<span className="font-mono text-[11px] text-warm-slate">{windowLabel}</span>}
      />

      {referrers.length === 0 ? (
        <EmptyState
          icon="share"
          title="No inbound sources yet"
          description="Readings arrive here once someone reaches a post from somewhere else."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-warm-border text-[10.5px] text-warm-slate uppercase">
                <th scope="col" className="pb-2.5 font-medium">Source</th>
                <th scope="col" className="pb-2.5 font-medium">Visitors</th>
                <th scope="col" className="pb-2.5 font-medium">Share of reads</th>
                <th scope="col" className="pb-2.5 text-right font-medium">Avg duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-border/50">
              {referrers.map((referrer) => {
                // A null host is a reader who arrived with no referrer, which is a real
                // and usually large source — not a gap in the data.
                const host = referrer.host ?? "Direct / no referrer";
                const colour = referrer.host
                  ? (HOST_COLOURS[referrer.host] ?? "var(--color-warm-accent)")
                  : "var(--color-warm-slate)";

                return (
                  <tr key={host}>
                    <td className="py-2.5">
                      <span className="flex items-center gap-2 font-medium text-warm-black">
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: colour }}
                        />
                        <span className="truncate">{host}</span>
                      </span>
                    </td>
                    <td className="py-2.5 text-warm-black">{formatCount(referrer.uniqueVisitors ?? 0)}</td>
                    <td className="py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded bg-warm-sunken">
                          <span
                            className="block h-full bg-warm-black"
                            style={{ width: `${Math.min(100, (referrer.share ?? 0) * 100)}%` }}
                          />
                        </span>
                        <span className="text-[11px] text-warm-slate">
                          {formatShare(referrer.share ?? 0)}
                        </span>
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-warm-slate">
                      {formatDuration(referrer.avgDwellSeconds ?? 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
