import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * What a panel shows instead of a chart or a list when there is nothing in it. Says which
 * of the two it is — nothing has happened yet, or something went wrong — because the
 * prototype had no state for either and they call for different reactions.
 */
export function EmptyState({
  icon = "stats",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded border border-dashed border-warm-border bg-warm-sunken/40 px-6 py-10 text-center">
      <Icon name={icon} className="text-[22px] text-warm-slate/70" />
      <p className="font-serif text-[15px] font-medium text-warm-black">{title}</p>
      {description ? (
        <p className="max-w-sm text-[12.5px] leading-relaxed text-warm-slate">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
