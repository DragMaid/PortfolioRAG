"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import type { Project } from "@/lib/types";

type ProjectPosterProps = {
  project: Project;
  isActive: boolean;
  /** When the rotation is running on this poster, how long until it moves on. */
  countdownMs: number | null;
  /** Clicked: choose this film, morphing the poster up onto the screen. */
  onChoose: () => void;
  /** Lingered on: put it on the screen without the ceremony. */
  onPreview: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  ref?: React.Ref<HTMLButtonElement>;
  /** The poster art, which the choosing morph starts from. */
  artRef?: React.Ref<HTMLImageElement>;
  panelId: string;
  /** Sizing from the section: fixed on the shelf, the column's width in the grid. */
  className?: string;
  /** In the grid there is room for more of the pitch. */
  summaryLines?: 2 | 3;
};

/** How long a pointer has to rest on a poster before the screen shows it. */
const PREVIEW_DELAY_MS = 380;

/**
 * One film on the shelf: the project's thumbnail as key art, with its title and summary on
 * the card beneath it, where they read on paper rather than over a picture.
 *
 * A tab, because choosing it changes the screen above. Resting on it previews it the way a
 * streaming shelf does; the delay keeps a pointer passing across the shelf from flicking
 * the screen through every film on the way.
 */
export function ProjectPoster({
  project,
  isActive,
  countdownMs,
  onChoose,
  onPreview,
  onKeyDown,
  ref,
  artRef,
  panelId,
  className,
  summaryLines = 2,
}: ProjectPosterProps) {
  const timer = useRef<number | undefined>(undefined);

  const linger = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse" || isActive) return;
    timer.current = window.setTimeout(onPreview, PREVIEW_DELAY_MS);
  };
  const leave = () => window.clearTimeout(timer.current);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={`${panelId}-tab-${project.index}`}
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      onClick={() => {
        leave();
        onChoose();
      }}
      onPointerEnter={linger}
      onPointerLeave={leave}
      onKeyDown={onKeyDown}
      data-active={isActive}
      className={cn(
        "poster group flex flex-col overflow-hidden border border-warm-border bg-warm-surface text-left rounded-sm",
        className,
      )}
    >
      <span className="relative block aspect-video overflow-hidden bg-marquee">
        {/* Plain <img>: the src redirects to a signed link the image optimizer would outlive. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={artRef}
          src={project.thumbnailUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="poster-art absolute inset-0 size-full object-cover"
        />

        {/* The rotation's countdown, on the film it is counting down. */}
        {countdownMs !== null ? (
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-marquee-ink/20">
            <span
              className="animate-autoplay-progress block h-full bg-marquee-ink"
              style={{ animationDuration: `${countdownMs}ms` }}
            />
          </span>
        ) : null}
      </span>

      <span className="flex flex-1 flex-col gap-1.5 p-4 sm:p-5">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-warm-slate tabular-nums">
          No. {project.index}
          {project.year ? ` · ${project.year}` : ""}
        </span>
        <span className="line-clamp-1 text-balance font-serif text-xl leading-tight text-warm-black sm:text-2xl">
          {project.title}
        </span>
        {/* The pitch, so a film can be judged from the shelf before it is put on screen. */}
        {project.summary ? (
          <span
            className={cn(
              "text-sm leading-relaxed text-warm-black/75",
              summaryLines === 3 ? "line-clamp-3" : "line-clamp-2",
            )}
          >
            {project.summary}
          </span>
        ) : null}
      </span>
    </button>
  );
}
