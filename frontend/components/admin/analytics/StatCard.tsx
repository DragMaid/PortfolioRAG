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
    <Panel className="flex min-w-0 flex-col justify-between gap-2 p-4">
      <div className="flex items-center justify-between gap-2 text-warm-slate">
        <span className="text-[13px] font-medium">{label}</span>
        <Icon name={icon} className="text-[18px] text-warm-accent" />
      </div>

      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <span title={value} className="max-w-full truncate text-2xl font-semibold tracking-tight text-warm-black tabular-nums">
          {value}
        </span>
        {delta ? (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums",
              rising ? "bg-warm-success-bg text-warm-success" : "bg-warm-danger-bg text-warm-danger",
            )}
          >
            {delta}
          </span>
        ) : null}
      </div>

      <span className="text-[13px] text-warm-slate">{footnote}</span>
    </Panel>
  );
}
