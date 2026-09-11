"use client";

import { ProjectArt, thumbnailGradient } from "@/components/projects/ProjectArt";
import { cn } from "@/lib/cn";
import type { Project } from "@/lib/types";

type ProjectCardProps = {
  project: Project;
  isActive: boolean;
  onSelect: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  ref?: React.Ref<HTMLButtonElement>;
  /** Id of the preview panel this card drives. */
  panelId: string;
};

/**
 * A carousel card. Rendered as a tab because selecting it swaps the preview
 * banner above; the title is a styled div rather than a heading so the card
 * does not compete with the banner's real heading.
 */
export function ProjectCard({
  project,
  isActive,
  onSelect,
  onKeyDown,
  ref,
  panelId,
}: ProjectCardProps) {
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={`${panelId}-tab-${project.index}`}
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={cn(
        "group flex w-80 shrink-0 snap-center flex-col justify-between rounded-2xl border bg-warm-surface text-left transition-all duration-300 sm:w-90",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-warm-accent",
        isActive
          ? "-translate-y-4 border-2 border-warm-black shadow-elevated"
          : "border-warm-border shadow-card hover:border-warm-black",
      )}
    >
      <div
        className={cn(
          "flex h-44 w-full flex-col justify-between rounded-t-2xl border-b border-warm-border bg-gradient-to-br p-4",
          thumbnailGradient[project.thumbnail],
        )}
      >
        <div className="flex items-center justify-between font-mono text-[11px] text-warm-slate">
          <span className="rounded border border-warm-border bg-warm-surface px-2 py-0.5 font-semibold text-warm-accent">
            {project.index}
          </span>
          <span className="font-medium text-warm-black">{project.year}</span>
        </div>

        <ProjectArt kind={project.thumbnail} />

        <div className="flex items-center justify-between font-mono text-[10px] text-warm-slate">
          <span>{project.thumbnailFooter.left}</span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5",
              project.thumbnailFooter.highlight
                ? "bg-emerald-50 font-semibold text-emerald-700"
                : "border border-warm-border bg-warm-surface text-warm-black",
            )}
          >
            {project.thumbnailFooter.right}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-6">
        <div>
          <div className="font-serif text-xl font-normal text-warm-black">
            {project.title}
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-warm-slate">
            {project.summary}
          </p>
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-warm-border pt-3.5 font-mono text-[11px]">
          <span className="text-warm-slate">{project.domain}</span>
          <span className="font-semibold text-warm-black transition-transform group-hover:translate-x-0.5">
            Inspect Artifact ↑
          </span>
        </div>
      </div>
    </button>
  );
}
