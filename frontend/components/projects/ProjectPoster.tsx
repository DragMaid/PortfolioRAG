"use client";

import { useEffect, useRef } from "react";
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
};

/** How long a pointer has to rest on a poster before the screen shows it. */
const PREVIEW_DELAY_MS = 380;

/**
 * One film on the shelf: the project's thumbnail as key art, with its title set over the
 * foot of it like a poster's billing block.
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
      className="poster group relative aspect-[2/3] w-36 shrink-0 snap-start overflow-hidden rounded-xl bg-marquee text-left sm:w-44 lg:w-48"
    >
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

      <span aria-hidden className="poster-shade absolute inset-0" />

      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-3.5 text-marquee-ink sm:p-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-marquee-dim tabular-nums">
          No. {project.index}
          {project.year ? ` · ${project.year}` : ""}
        </span>
        <span className="line-clamp-3 text-balance font-serif text-lg leading-tight sm:text-xl">
          {project.title}
        </span>
      </span>

      {/* The rotation's countdown, on the film it is counting down. */}
      {countdownMs !== null ? (
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-marquee-ink/15">
          <span
            className="animate-autoplay-progress block h-full bg-marquee-ink"
            style={{ animationDuration: `${countdownMs}ms` }}
          />
        </span>
      ) : null}
    </button>
  );
}
