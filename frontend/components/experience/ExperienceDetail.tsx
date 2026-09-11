import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ExperienceEntry } from "@/lib/types";

type ExperienceDetailProps = {
  entry: ExperienceEntry;
  panelId: string;
  /** Id of the tab currently driving this panel. */
  labelledBy: string;
};

/** Expanded view of the selected role. */
export function ExperienceDetail({
  entry,
  panelId,
  labelledBy,
}: ExperienceDetailProps) {
  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      /* Keying on the role restarts the entrance animation on every switch. */
      key={entry.id}
      className="mt-6 animate-fade-rise rounded-xl border border-warm-border bg-warm-bg/90 p-6 sm:p-7 md:mt-2"
    >
      <div className="flex flex-col justify-between gap-3 border-b border-warm-border/70 pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded border border-warm-border bg-warm-surface px-2.5 py-1 font-mono text-xs font-semibold text-warm-black shadow-sm">
              {entry.company}
            </span>
            <h3 className="font-serif text-lg font-medium text-warm-black sm:text-xl">
              {entry.role}
            </h3>
          </div>
          {entry.team ? (
            <p className="mt-1.5 font-mono text-xs text-warm-slate">{entry.team}</p>
          ) : null}
        </div>
        <span className="self-start rounded-lg border border-warm-border bg-warm-surface px-3 py-1.5 font-mono text-xs text-warm-slate shadow-sm sm:self-auto">
          {entry.duration}
        </span>
      </div>

      {/* The description is Markdown, so this is a list only if the author wrote one —
          the fixed bullet list this replaced could not hold a paragraph or a link. */}
      {entry.description ? (
        <div className="mt-5">
          <h4 className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-warm-accent">
            Architectural Highlights &amp; Systems Impact
          </h4>
          <div className="prose-studio">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.description}</ReactMarkdown>
          </div>
        </div>
      ) : null}
    </div>
  );
}
