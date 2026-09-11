"use client";

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
      <div className="relative h-44 w-full overflow-hidden rounded-t-2xl border-b border-warm-border bg-warm-hover">
        {/*
         * The author's own thumbnail, which every published project has. It replaces the
         * geometric stand-in the design carried while there was no upload to draw.
         *
         * A plain <img>, not next/image: the src is an API route that redirects to a
         * signed link with a deadline on it, and the optimizer would cache the redirect
         * past that deadline and then serve a broken picture.
         */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={project.thumbnailUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* A wash under the chips, so light thumbnails do not swallow them. */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-warm-bg/85 to-transparent"
        />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 font-mono text-[11px]">
          <span className="rounded border border-warm-border bg-warm-surface/90 px-2 py-0.5 font-semibold text-warm-accent backdrop-blur-sm">
            {project.index}
          </span>
          {project.year ? (
            <span className="rounded bg-warm-surface/90 px-2 py-0.5 font-medium text-warm-black backdrop-blur-sm">
              {project.year}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-6">
        <div>
          {project.category ? (
            <span className="font-mono text-[10px] font-semibold tracking-wider text-warm-accent uppercase">
              {project.category}
            </span>
          ) : null}
          <div className="mt-1 font-serif text-xl font-normal text-warm-black">
            {project.title}
          </div>
          {project.summary ? (
            <p className="mt-2.5 line-clamp-3 text-xs leading-relaxed text-warm-slate">
              {project.summary}
            </p>
          ) : null}
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
