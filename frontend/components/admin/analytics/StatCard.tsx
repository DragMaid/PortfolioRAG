import { cn } from "@/lib/cn";
import { formatChange } from "@/lib/admin/format";
import { Icon, type IconName } from "../ui/Icon";
import { Panel } from "../ui/Panel";

/**
 * One headline figure, with its change against the window before it.
 *
 * The change is only drawn when there is a previous window to compare against — the API
 * sends null rather than zero for "nothing to compare", and rendering that as +0.0% would
 * claim a flat week that never happened.
 */
export function StatCard({
  label,
  icon,
  value,
  change,
  footnote,
}: {
  label: string;
  icon: IconName;
  value: string;
  change?: number | null;
  footnote: string;
}) {
  const delta = formatChange(change);
  const rising = (change ?? 0) >= 0;

  return (
    <Panel className="flex flex-col justify-between gap-2 p-4">
      <div className="flex items-center justify-between gap-2 text-warm-slate">
        <span className="font-mono text-[11px] font-semibold tracking-wider uppercase">{label}</span>
        <Icon name={icon} className="text-[18px] text-warm-accent" />
      </div>

      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-2xl font-bold text-warm-black">{value}</span>
        {delta ? (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold",
              rising ? "bg-warm-success-bg text-warm-success" : "bg-warm-danger-bg text-warm-danger",
            )}
          >
            {delta}
          </span>
        ) : null}
      </div>

      <span className="font-mono text-[11px] text-warm-slate">{footnote}</span>
    </Panel>
  );
}
