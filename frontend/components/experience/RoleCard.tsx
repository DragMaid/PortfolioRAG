"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CompanyMark } from "@/components/experience/CompanyMark";
import type { ExperienceEntry } from "@/lib/types";

type RoleCardProps = {
  entry: ExperienceEntry;
  /** The light on the thread has reached this role. */
  isLit: boolean;
  /** This role's write-up is the one shown beside the thread. */
  isActive: boolean;
  /** The first role on the thread, i.e. the most recent one. */
  isCurrent: boolean;
  onSelect: () => void;
  /** Id of the write-up panel the card drives on desktop. */
  panelId: string;
  /** The node on the thread, which the section measures the light against. */
  ref?: React.Ref<HTMLElement>;
};

/**
 * Leans the card toward the pointer, and moves the sheen across it with it.
 *
 * Written straight to the element's style: a re-render per pointer move would be the
 * wrong price for a few degrees of tilt. Mouse only — a finger has nothing to hover with.
 */
function lean(event: React.PointerEvent<HTMLElement>) {
  if (event.pointerType !== "mouse") return;
  const card = event.currentTarget;
  const box = card.getBoundingClientRect();
  const x = (event.clientX - box.left) / box.width;
  const y = (event.clientY - box.top) / box.height;
  card.style.setProperty("--rx", `${((0.5 - y) * 5).toFixed(2)}deg`);
  card.style.setProperty("--ry", `${((x - 0.5) * 6).toFixed(2)}deg`);
  card.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
  card.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
}

function settle(event: React.PointerEvent<HTMLElement>) {
  const card = event.currentTarget;
  for (const name of ["--rx", "--ry", "--mx", "--my"]) card.style.removeProperty(name);
}

/** One role hanging from the career thread: its node, and the paper card beside it. */
export function RoleCard({
  entry,
  isLit,
  isActive,
  isCurrent,
  onSelect,
  panelId,
  ref,
}: RoleCardProps) {
  const isOngoing = entry.period.endsWith("Present");

  return (
    <li
      className="role relative grid grid-cols-[3.5rem_1fr] items-start gap-4 sm:gap-6"
      data-lit={isLit}
      data-active={isActive}
    >
      <span ref={ref} aria-hidden className="role-node">
        <span className="role-node-mark">
          <CompanyMark company={entry.company} logoUrl={entry.logoUrl} />
        </span>
      </span>

      <article
        className="role-card group relative rounded-2xl border border-warm-border bg-warm-surface p-5 sm:p-6"
        onPointerMove={lean}
        onPointerLeave={settle}
      >
        <span aria-hidden className="role-sheen" />

        <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-mono text-xs text-warm-slate">
          <span className="tabular-nums">{entry.period}</span>
          {isOngoing && isCurrent ? (
            <span className="flex items-center gap-1.5 text-warm-black">
              <span aria-hidden className="role-now" />
              Current role
            </span>
          ) : null}
        </div>

        <h3 className="relative mt-3 text-balance font-serif text-xl leading-snug text-warm-black sm:text-2xl">
          {entry.role || entry.company}
        </h3>
        <p className="relative mt-1 text-sm text-warm-slate">
          <span className="font-medium text-warm-black">{entry.company}</span>
          {entry.team ? <> · {entry.team}</> : null}
        </p>
        {entry.duration ? (
          <p className="relative mt-4 font-mono text-[11px] tabular-nums text-warm-slate">
            {entry.duration}
          </p>
        ) : null}

        {/* Small screens: the write-up belongs to its card, there being no room beside it. */}
        {entry.description ? (
          <div className="prose-studio relative mt-5 border-t border-warm-hairline pt-5 lg:hidden">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.description}</ReactMarkdown>
          </div>
        ) : null}

        {/* Desktop: the whole card shows its write-up in the panel beside the thread. */}
        <button
          type="button"
          onClick={onSelect}
          onFocus={onSelect}
          aria-controls={panelId}
          aria-current={isActive}
          className="absolute inset-0 hidden rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-warm-accent lg:block"
        >
          <span className="sr-only">
            Show the write-up for {entry.role || "the role"} at {entry.company}
          </span>
        </button>
      </article>
    </li>
  );
}
