"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
} from "@/components/icons";
import { ProjectMarquee } from "@/components/projects/ProjectMarquee";
import { ProjectPoster } from "@/components/projects/ProjectPoster";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useRovingTabList } from "@/components/ui/useRovingTabList";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import type { Project } from "@/lib/types";

const PANEL_ID = "project-preview";
const AUTOPLAY_MS = 6000;
/** The name the chosen poster and the screen share for the length of the morph. */
const MORPH_NAME = "marquee-art";
/** How long the morph will wait for the screen's picture to decode before going anyway. */
const DECODE_BUDGET_MS = 250;

/** How much of the visible shelf one press of a side arrow moves past. */
const PAGE_FRACTION = 0.85;

const sideArrowClasses =
  "absolute top-[calc(50%-0.25rem)] z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-warm-border bg-warm-surface/90 text-warm-black shadow-lg backdrop-blur transition-[opacity,background-color] duration-300 hover:bg-warm-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-accent";

const controlClasses =
  "flex size-9 items-center justify-center rounded-full border border-warm-border bg-warm-surface text-warm-black transition-colors hover:bg-warm-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-accent";

/**
 * Selected works, browsed like films: a screen showing the chosen project's trailer, and a
 * shelf of posters under it.
 *
 * Choosing a poster lifts it onto the screen — a view transition morphs the poster's art
 * into the backdrop. Everything else that changes the film (the rotation, the arrows,
 * lingering on a poster) cross-fades instead: a morph is an answer to a click, and a page
 * that morphs on its own while somebody reads elsewhere is just moving.
 */
export function ProjectsSection({ projects }: { projects: Project[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  /* Every film that has been on screen; its backdrop stays mounted and loaded. */
  const [shown, setShown] = useState(() => new Set([0]));
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  /* Hover, keyboard focus or a backgrounded tab all suspend the rotation
     without clearing the user's own play/pause choice. */
  const [isInteracting, setIsInteracting] = useState(false);
  const [isPageHidden, setIsPageHidden] = useState(false);

  const shelfRef = useRef<HTMLDivElement>(null);
  /* Whether the shelf has films past either edge, which is what the side arrows show. */
  const [overflow, setOverflow] = useState({ start: false, end: false });
  const marqueeRef = useRef<HTMLDivElement>(null);
  const posterArt = useRef<(HTMLImageElement | null)[]>([]);
  const prefersReducedMotion = usePrefersReducedMotion();

  const count = projects.length;

  const show = useCallback((index: number) => setActiveIndex(index), []);

  const step = useCallback(
    (delta: number) => setActiveIndex((index) => (index + delta + count) % count),
    [count],
  );

  /* The marquee always mounts the film on screen; this keeps it mounted once it leaves. */
  if (!shown.has(activeIndex)) setShown(new Set(shown).add(activeIndex));

  const {
    registerRef,
    onKeyDown,
    refs: posterRefs,
  } = useRovingTabList(count, show);

  /** A click on a poster: morph it up onto the screen where the browser can. */
  const choose = (index: number) => {
    if (index === activeIndex) return;

    const poster = posterArt.current[index];
    if (!document.startViewTransition || prefersReducedMotion || !poster) {
      show(index);
      return;
    }

    let screen: HTMLElement | null = null;
    const root = document.documentElement;
    poster.style.viewTransitionName = MORPH_NAME;
    root.setAttribute("data-morphing", "");

    const transition = document.startViewTransition(async () => {
      poster.style.viewTransitionName = "";
      flushSync(() => show(index));

      screen = marqueeRef.current?.querySelector<HTMLElement>(
        `[data-art="${CSS.escape(projects[index].slug)}"]`,
      ) ?? null;
      if (!screen) return;
      screen.style.viewTransitionName = MORPH_NAME;

      // The screen's picture is the poster's own, already fetched; give it a moment to decode
      // so the morph does not land on an empty frame, but never hold the page for it.
      const art = screen.querySelector("img");
      await Promise.race([
        art?.decode().catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, DECODE_BUDGET_MS)),
      ]);
    });

    // A skipped transition (a hidden tab, a second click mid-morph) still applies the change;
    // only the animation is lost, which is not worth an error.
    transition.ready.catch(() => {});
    transition.finished.finally(() => {
      if (screen) screen.style.viewTransitionName = "";
      root.removeAttribute("data-morphing");
    });
  };

  /* Bring the chosen poster into view within the shelf, without scrolling the page. */
  useEffect(() => {
    const shelf = shelfRef.current;
    const poster = posterRefs.current[activeIndex];
    if (!shelf || !poster) return;

    const left = poster.offsetLeft;
    const right = left + poster.offsetWidth;
    if (left >= shelf.scrollLeft && right <= shelf.scrollLeft + shelf.clientWidth) return;

    shelf.scrollTo({
      left: left - (shelf.clientWidth - poster.offsetWidth) / 2,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
    /* `posterRefs` is a stable ref object; listed only to satisfy the lint rule. */
  }, [activeIndex, prefersReducedMotion, posterRefs]);

  const measureShelf = useCallback(() => {
    const shelf = shelfRef.current;
    if (!shelf) return;

    // A pixel of slack: fractional widths can leave the far end a hair short of the max.
    const start = shelf.scrollLeft > 1;
    const end = shelf.scrollLeft + shelf.clientWidth < shelf.scrollWidth - 1;
    setOverflow((current) =>
      current.start === start && current.end === end ? current : { start, end },
    );
  }, []);

  /* Re-measured on resize as well as scroll: a wider window can fit the whole shelf. */
  useEffect(() => {
    const shelf = shelfRef.current;
    if (!shelf) return;

    measureShelf();
    const observer = new ResizeObserver(measureShelf);
    observer.observe(shelf);
    return () => observer.disconnect();
  }, [measureShelf, count]);

  const pageShelf = (direction: -1 | 1) => {
    const shelf = shelfRef.current;
    if (!shelf) return;

    shelf.scrollBy({
      left: direction * shelf.clientWidth * PAGE_FRACTION,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  useEffect(() => {
    const sync = () => setIsPageHidden(document.hidden);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  const isPlaying =
    autoplayEnabled &&
    !isInteracting &&
    !isPageHidden &&
    !prefersReducedMotion &&
    count > 1;

  /* A fresh countdown per film, so a manual step restarts it and the bar on the poster
     always tells the truth about when the next one comes. */
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(() => step(1), AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [isPlaying, step, activeIndex]);

  if (count === 0) return null;

  const active = projects[activeIndex];
  const suspend = () => setIsInteracting(true);
  const resume = () => setIsInteracting(false);

  return (
    <section id="projects" className="scroll-mt-24">
      <SectionHeading
        eyebrow="03 / Selected Works"
        title="Engineering Artifacts & Software"
        className="mb-10"
        action={
          count > 1 ? (
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-warm-slate tabular-nums">
                <span className="sr-only">Showing project </span>
                {String(activeIndex + 1).padStart(2, "0")}
                <span aria-hidden> / </span>
                <span className="sr-only"> of </span>
                {String(count).padStart(2, "0")}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Previous project"
                  className={controlClasses}
                >
                  <ChevronLeftIcon className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Next project"
                  className={controlClasses}
                >
                  <ChevronRightIcon className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setAutoplayEnabled((value) => !value)}
                  aria-pressed={!autoplayEnabled}
                  aria-label={autoplayEnabled ? "Pause auto-rotation" : "Resume auto-rotation"}
                  className={controlClasses}
                >
                  {autoplayEnabled ? (
                    <PauseIcon className="size-3.5" />
                  ) : (
                    <PlayIcon className="size-3.5" />
                  )}
                </button>
              </div>
            </div>
          ) : undefined
        }
      />

      <div
        ref={marqueeRef}
        onMouseEnter={suspend}
        onMouseLeave={resume}
        onFocusCapture={suspend}
        onBlurCapture={resume}
      >
        <ProjectMarquee
          projects={projects}
          activeIndex={activeIndex}
          mounted={shown}
          panelId={PANEL_ID}
          labelledBy={`${PANEL_ID}-tab-${active.index}`}
          prefersReducedMotion={prefersReducedMotion}
        />
      </div>

      {count > 1 ? (
        /* The rotation pauses for the arrows too, so it lives on the wrapper, not the shelf. */
        <div
          className="relative mt-10"
          onMouseEnter={suspend}
          onMouseLeave={resume}
          onFocusCapture={suspend}
          onBlurCapture={resume}
        >
          <div
            ref={shelfRef}
            role="tablist"
            aria-label="Selected works"
            onScroll={measureShelf}
            className="shelf no-scrollbar -mx-6 flex snap-x gap-4 overflow-x-auto scroll-px-6 px-6 pb-6 pt-4 sm:-mx-8 sm:scroll-px-8 sm:px-8 sm:gap-5"
          >
            {projects.map((project, index) => (
              <ProjectPoster
                key={project.slug}
                ref={registerRef(index)}
                artRef={(element) => {
                  posterArt.current[index] = element;
                }}
                project={project}
                isActive={index === activeIndex}
                countdownMs={isPlaying && index === activeIndex ? AUTOPLAY_MS : null}
                onChoose={() => choose(index)}
                onPreview={() => show(index)}
                onKeyDown={(event) => onKeyDown(event, index)}
                panelId={PANEL_ID}
              />
            ))}
          </div>

          {/* Scroll the shelf, not the film: the screen changes only when a poster is chosen.
              Each arrow fades out at its end, so its presence says whether there is more. */}
          <button
            type="button"
            onClick={() => pageShelf(-1)}
            aria-label="Scroll works back"
            aria-hidden={!overflow.start}
            tabIndex={overflow.start ? 0 : -1}
            className={cn(
              sideArrowClasses,
              "-left-3 sm:-left-5",
              !overflow.start && "pointer-events-none opacity-0",
            )}
          >
            <ChevronLeftIcon className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => pageShelf(1)}
            aria-label="Scroll works forward"
            aria-hidden={!overflow.end}
            tabIndex={overflow.end ? 0 : -1}
            className={cn(
              sideArrowClasses,
              "-right-3 sm:-right-5",
              !overflow.end && "pointer-events-none opacity-0",
            )}
          >
            <ChevronRightIcon className="size-5" />
          </button>
        </div>
      ) : null}
    </section>
  );
}
