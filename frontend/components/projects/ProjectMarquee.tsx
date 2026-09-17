"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRightIcon, ChevronRightIcon, GitHubIcon, PauseIcon, PlayIcon } from "@/components/icons";
import type { Project } from "@/lib/types";

type Media = HTMLImageElement | HTMLVideoElement;

type ProjectMarqueeProps = {
  projects: Project[];
  activeIndex: number;
  /** Projects whose backdrop has been shown before, kept mounted so returning is instant. */
  mounted: Set<number>;
  panelId: string;
  labelledBy: string;
  prefersReducedMotion: boolean;
};

/** One sample of the backdrop every this many milliseconds: enough for light, not a render loop. */
const SAMPLE_MS = 90;
/** How much of each new sample is laid over the last, so the light drifts rather than cuts. */
const SAMPLE_WEIGHT = 0.16;
/** A still is sampled until the light has settled on it, then the loop stops. */
const STILL_SAMPLES = 40;

/**
 * The light the backdrop throws onto the page around it.
 *
 * The media is drawn, tiny, into a canvas that is then blown up and blurred behind the
 * screen. Drawing is allowed where reading pixels is not, so this needs no CORS from the
 * media host — the trailer is on a signed link from another origin. Each sample is laid
 * over the previous one at low weight, so switching films fades the light from one to the
 * other on its own, without keeping two canvases.
 */
function useAmbientLight(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  getSource: () => Media | null,
  key: string,
  prefersReducedMotion: boolean,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let timer = 0;
    let samples = 0;
    let visible = true;

    const draw = (weight: number) => {
      const source = getSource();
      if (!source) return false;
      const ready =
        source instanceof HTMLVideoElement
          ? source.readyState >= 2
          : source.complete && source.naturalWidth > 0;
      if (!ready) return false;

      context.globalAlpha = weight;
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      return true;
    };

    const tick = () => {
      timer = 0;
      if (!visible || document.hidden) return;

      if (draw(prefersReducedMotion ? 1 : SAMPLE_WEIGHT)) samples += 1;

      const source = getSource();
      const isMoving = source instanceof HTMLVideoElement && !source.paused;
      // Stills (and paused footage) only need to settle; moving footage keeps sampling.
      if (prefersReducedMotion && samples > 0 && !isMoving) return;
      if (!isMoving && samples >= STILL_SAMPLES) return;
      timer = window.setTimeout(tick, SAMPLE_MS);
    };

    const restart = () => {
      samples = 0;
      if (!timer) tick();
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible) restart();
    });
    observer.observe(canvas);

    const source = getSource();
    source?.addEventListener("load", restart);
    source?.addEventListener("loadeddata", restart);
    source?.addEventListener("play", restart);
    document.addEventListener("visibilitychange", restart);

    restart();

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      source?.removeEventListener("load", restart);
      source?.removeEventListener("loadeddata", restart);
      source?.removeEventListener("play", restart);
      document.removeEventListener("visibilitychange", restart);
    };
    // `getSource` reads refs, so a new closure per render changes nothing; `key` is the film.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, key, prefersReducedMotion]);
}

/**
 * The screen at the top of the section: the chosen project's trailer, full bleed, with its
 * title card laid over it and its light spilling out onto the page.
 *
 * Every backdrop that has been shown stays mounted underneath, so going back to a project
 * cross-fades to footage that is already loaded instead of fetching it again — and a trailer
 * never has its load torn down by the rotation moving on.
 */
export function ProjectMarquee({
  projects,
  activeIndex,
  mounted,
  panelId,
  labelledBy,
  prefersReducedMotion,
}: ProjectMarqueeProps) {
  const active = projects[activeIndex];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRefs = useRef<(Media | null)[]>([]);
  /* The reader's own play/pause, once they have pressed it. */
  const [pausedByReader, setPausedByReader] = useState<boolean | null>(null);

  /* Until then, reduced motion starts with the footage still. */
  const trailerPaused = pausedByReader ?? prefersReducedMotion;

  useAmbientLight(canvasRef, () => mediaRefs.current[activeIndex] ?? null, active.slug, prefersReducedMotion);

  /* Only the film on screen plays. */
  useEffect(() => {
    mediaRefs.current.forEach((media, index) => {
      if (!(media instanceof HTMLVideoElement)) return;
      if (index === activeIndex && !trailerPaused) {
        media.play().catch(() => {});
      } else {
        media.pause();
      }
    });
  }, [activeIndex, trailerPaused, mounted]);

  return (
    <div className="relative">
      {/* The light off the screen. Decorative, and drawn only where there is room for it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-y-[14%] inset-x-0 -z-10 lg:-inset-x-6 xl:-inset-x-16"
      >
        <canvas ref={canvasRef} width={32} height={18} className="marquee-ambient size-full" />
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="marquee relative isolate flex flex-col overflow-hidden rounded-3xl bg-marquee text-marquee-ink lg:aspect-[2.39/1] lg:min-h-[27rem]"
      >
        <div className="relative aspect-video w-full lg:absolute lg:inset-0 lg:aspect-auto">
          {projects.map((project, index) => {
            if (!mounted.has(index) && index !== activeIndex) return null;
            const isActive = index === activeIndex;

            return (
              <div
                key={project.slug}
                data-art={project.slug}
                data-active={isActive}
                aria-hidden={!isActive}
                className="marquee-layer absolute inset-0"
              >
                {/*
                 * The poster's own image underneath the trailer: it is already loaded from the
                 * shelf, so the screen has a picture the moment a film is chosen, and it is what
                 * the poster morphs into.
                 *
                 * Plain <img>/<video>: the src is an API route that redirects to a signed link
                 * with a deadline, which the image optimizer would cache past its expiry.
                 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={project.thumbnailUrl}
                  alt=""
                  decoding="async"
                  className="marquee-art absolute inset-0 size-full object-cover"
                />
                {project.trailer.isVideo ? (
                  <video
                    ref={(element) => {
                      mediaRefs.current[index] = element;
                    }}
                    src={project.trailer.url}
                    muted
                    loop
                    playsInline
                    preload={isActive ? "auto" : "metadata"}
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    ref={(element) => {
                      mediaRefs.current[index] = element;
                    }}
                    src={project.trailer.url}
                    alt=""
                    decoding="async"
                    className="absolute inset-0 size-full object-cover"
                  />
                )}
              </div>
            );
          })}

          {/* Shades the footage where the title card sits. */}
          <div aria-hidden className="marquee-scrim pointer-events-none absolute inset-0" />

          {active.trailer.isVideo ? (
            <button
              type="button"
              onClick={() => setPausedByReader(!trailerPaused)}
              aria-pressed={trailerPaused}
              className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full bg-marquee/55 px-3 py-1.5 font-mono text-[11px] text-marquee-ink backdrop-blur-md transition-colors hover:bg-marquee/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquee-ink"
            >
              {trailerPaused ? <PlayIcon className="size-3" /> : <PauseIcon className="size-3" />}
              {trailerPaused ? "Play trailer" : "Pause trailer"}
            </button>
          ) : null}
        </div>

        {/* The title card. Keyed, so each film's title is inked in as it comes up. */}
        <div
          key={active.slug}
          className="relative z-10 flex max-w-xl flex-col gap-4 p-6 sm:p-8 lg:absolute lg:bottom-0 lg:left-0 lg:p-12"
        >
          <p className="marquee-credit flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em] text-marquee-dim">
            <span className="tabular-nums">No. {active.index}</span>
            {active.year ? (
              <>
                <span aria-hidden className="size-1 rounded-full bg-current" />
                <span className="tabular-nums">{active.year}</span>
              </>
            ) : null}
            <span aria-hidden className="size-1 rounded-full bg-current" />
            <span>{active.trailer.isVideo ? "Trailer" : "Still"}</span>
          </p>

          <h3 className="marquee-title text-balance font-serif text-3xl leading-[1.05] tracking-[-0.02em] sm:text-4xl lg:text-5xl xl:text-6xl">
            {active.title}
          </h3>

          {active.summary ? (
            <p className="marquee-summary line-clamp-3 max-w-md text-sm leading-relaxed text-marquee-dim sm:text-base">
              {active.summary}
            </p>
          ) : null}

          <div className="marquee-actions flex flex-wrap items-center gap-2.5 pt-2">
            <Link
              href={active.href}
              className="group flex items-center gap-2 rounded-full bg-marquee-ink px-5 py-2.5 text-sm font-semibold text-marquee transition-transform hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquee-ink"
            >
              Read the write-up
              <ChevronRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            {active.links.repo ? (
              <a
                href={active.links.repo}
                target="_blank"
                rel="noopener noreferrer"
                className={secondaryAction}
              >
                <GitHubIcon className="size-4" />
                Repository
              </a>
            ) : null}
            {active.links.demo ? (
              <a
                href={active.links.demo}
                target="_blank"
                rel="noopener noreferrer"
                className={secondaryAction}
              >
                Live demo
                <ArrowUpRightIcon className="size-3.5" />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

const secondaryAction =
  "flex items-center gap-2 rounded-full bg-marquee-ink/10 px-4 py-2.5 text-sm font-medium text-marquee-ink ring-1 ring-marquee-ink/20 backdrop-blur-md transition-colors hover:bg-marquee-ink/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquee-ink";
