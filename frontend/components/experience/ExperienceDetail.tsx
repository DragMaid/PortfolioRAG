import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CompanyMark } from "@/components/experience/CompanyMark";
import type { ExperienceEntry } from "@/lib/types";

/**
 * The write-up of the role the thread's light is on, held beside the thread on desktop.
 *
 * Not a live region: it changes as the reader scrolls, and announcing every role they
 * scroll past would talk over the page they are reading.
 */
export function ExperienceDetail({ entry, panelId }: { entry: ExperienceEntry; panelId: string }) {
  return (
    <div
      id={panelId}
      role="region"
      aria-label={`${entry.role || "Role"} at ${entry.company}`}
      className="role-panel relative overflow-hidden rounded-sm border border-warm-border bg-warm-surface"
    >
      {/* Keyed, so each role develops in rather than its words changing in place. */}
      <div key={entry.id} className="animate-role-develop p-8 xl:p-10">
        <div className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-warm-border bg-warm-bg p-2.5 text-warm-black">
            <CompanyMark company={entry.company} logoUrl={entry.logoUrl} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-warm-black">{entry.company}</p>
            {entry.team ? <p className="truncate text-sm text-warm-slate">{entry.team}</p> : null}
          </div>
        </div>

        <h3 className="mt-8 text-balance font-serif text-3xl leading-tight text-warm-black xl:text-4xl">
          {entry.role || entry.company}
        </h3>
        {entry.duration ? (
          <p className="mt-3 font-mono text-xs tabular-nums text-warm-slate">{entry.duration}</p>
        ) : null}

        {entry.description ? (
          <div className="prose-studio mt-8 max-w-prose border-t border-warm-hairline pt-8">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.description}</ReactMarkdown>
          </div>
        ) : (
          <p className="mt-8 border-t border-warm-hairline pt-8 text-sm text-warm-slate">
            No write-up for this role yet.
          </p>
        )}
      </div>
    </div>
  );
}
