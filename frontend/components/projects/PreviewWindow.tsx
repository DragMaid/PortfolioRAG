import { cn } from "@/lib/cn";
import type { Project, StatTone } from "@/lib/types";

const toneBar: Record<StatTone, string> = {
  positive: "bg-emerald-500",
  accent: "bg-warm-accent",
  neutral: "bg-warm-black",
};

function StatTile({
  label,
  value,
  fill,
  tone,
}: Project["stats"][number]) {
  return (
    <div className="rounded-lg border border-warm-border bg-warm-surface p-3 shadow-sm">
      <span className="font-mono text-[10px] uppercase text-warm-slate">{label}</span>
      <div className="mt-0.5 font-serif text-lg font-medium text-warm-black">
        {value}
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-warm-border/40">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", toneBar[tone])}
          style={{ width: `${Math.min(Math.max(fill, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}

/** Decorative neighbour graph standing in for a live telemetry view. */
function TopologyGraph() {
  return (
    <svg
      viewBox="0 0 400 120"
      preserveAspectRatio="none"
      className="size-full text-warm-border"
      aria-hidden
    >
      <line x1="50" y1="60" x2="150" y2="25" stroke="currentColor" strokeWidth={1.5} strokeDasharray="2 2" />
      <line x1="150" y1="25" x2="260" y2="85" stroke="currentColor" strokeWidth={1.5} strokeDasharray="2 2" />
      <line x1="260" y1="85" x2="350" y2="40" stroke="currentColor" strokeWidth={1.5} strokeDasharray="2 2" />
      <line x1="50" y1="60" x2="260" y2="85" stroke="var(--color-warm-accent)" strokeWidth={2} />
      <line x1="150" y1="25" x2="350" y2="40" stroke="var(--color-warm-accent)" strokeWidth={2} />
      <circle cx="50" cy="60" r="7" fill="var(--color-warm-black)" />
      <circle cx="150" cy="25" r="9" fill="var(--color-warm-accent)" />
      <circle cx="260" cy="85" r="8" fill="var(--color-warm-black)" />
      <circle cx="350" cy="40" r="10" fill="var(--color-warm-accent)" />
    </svg>
  );
}

/** Mock application window shown beside the project copy. */
export function PreviewWindow({ project }: { project: Project }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-warm-border bg-warm-bg shadow-inner">
      <div className="flex items-center justify-between gap-3 border-b border-warm-border bg-warm-hover/70 px-4 py-2.5 font-mono text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <div aria-hidden className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full bg-rose-400/80" />
            <span className="inline-block size-2.5 rounded-full bg-amber-400/80" />
            <span className="inline-block size-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <span className="ml-2 truncate rounded border border-warm-border/60 bg-warm-surface px-2 py-0.5 text-[11px] text-warm-slate">
            {project.previewUrl}
          </span>
        </div>
        <span className="shrink-0 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] uppercase text-emerald-800">
          Healthy
        </span>
      </div>

      <div className="space-y-4 bg-warm-surface/60 p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {project.stats.map((stat) => (
            <StatTile key={stat.label} {...stat} />
          ))}
        </div>

        <div className="rounded-xl border border-warm-border bg-warm-bg p-4">
          <div className="mb-3 flex items-center justify-between gap-2 font-mono text-[11px] text-warm-slate">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-warm-accent" />
              Multi-Dimensional Neighbor Topology
            </span>
            <span className="shrink-0 rounded border border-warm-border bg-warm-surface px-2 py-0.5 text-[10px] text-warm-black">
              Real-time Feed
            </span>
          </div>
          <div className="relative h-32 w-full">
            <TopologyGraph />
            <div className="absolute bottom-2 right-3 rounded border border-warm-border bg-warm-surface/80 px-2 py-0.5 font-mono text-[10px] text-warm-slate">
              Cosine Similarity: 0.9984
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
