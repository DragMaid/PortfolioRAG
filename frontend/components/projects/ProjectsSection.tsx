"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
} from "@/components/icons";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectCatalog } from "@/components/projects/ProjectCatalog";
import { ProjectPreview } from "@/components/projects/ProjectPreview";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useRovingTabList } from "@/components/ui/useRovingTabList";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import type { Project } from "@/lib/types";

const PANEL_ID = "project-preview";
const CATALOG_ID = "project-catalog";
const AUTOPLAY_MS = 5000;

const controlClasses =
  "flex size-9 items-center justify-center rounded-lg border border-warm-border bg-warm-surface text-warm-black transition-colors hover:bg-warm-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-accent disabled:opacity-40";

export function ProjectsSection({ projects }: { projects: Project[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  /* Hover, keyboard focus or a backgrounded tab all suspend the rotation
     without clearing the user's own play/pause choice. */
  const [isInteracting, setIsInteracting] = useState(false);
  const [isPageHidden, setIsPageHidden] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const count = projects.length;
  const step = useCallback(
    (delta: number) => setActiveIndex((index) => (index + delta + count) % count),
    [count],
  );

  /* The same refs back both keyboard navigation and the centring effect. */
  const {
    registerRef,
    onKeyDown,
    refs: cardRefs,
  } = useRovingTabList(count, setActiveIndex);

  /* Centre the selected card in its own scroll container. Avoids
     `scrollIntoView`, which also scrolls the page vertically. */
  useEffect(() => {
    const track = trackRef.current;
    const card = cardRefs.current[activeIndex];
    if (!track || !card) return;

    track.scrollTo({
      left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
    /* `cardRefs` is a stable ref object; listed only to satisfy the lint rule. */
  }, [activeIndex, prefersReducedMotion, cardRefs]);

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

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => step(1), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [isPlaying, step]);

  if (count === 0) return null;

  const active = projects[activeIndex];
  const suspend = () => setIsInteracting(true);
  const resume = () => setIsInteracting(false);

  return (
    <section id="projects" className="scroll-mt-24">
      <SectionHeading
        eyebrow="03 / Selected Works"
        title="Engineering Artifacts & Software"
        className="mb-8"
        action={
          <div className="flex items-center gap-3">
            <span aria-hidden className="font-mono text-xs text-warm-slate">
              {String(activeIndex + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
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
                aria-label={
                  autoplayEnabled ? "Pause auto-rotation" : "Resume auto-rotation"
                }
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
        }
      />

      <div onMouseEnter={suspend} onMouseLeave={resume} onFocusCapture={suspend}>
        <ProjectPreview
          project={active}
          panelId={PANEL_ID}
          labelledBy={`${PANEL_ID}-tab-${active.index}`}
        />
      </div>

      <div className="relative py-6">
        <div
          ref={trackRef}
          role="tablist"
          aria-label="Selected works"
          className="no-scrollbar relative flex snap-x snap-mandatory items-end gap-6 overflow-x-auto scroll-smooth pb-8 pt-4"
          onMouseEnter={suspend}
          onMouseLeave={resume}
          onFocusCapture={suspend}
          onBlurCapture={resume}
        >
          {projects.map((project, index) => (
            <ProjectCard
              key={project.slug}
              ref={registerRef(index)}
              project={project}
              isActive={index === activeIndex}
              onSelect={() => setActiveIndex(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              panelId={PANEL_ID}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 flex flex-col items-center justify-center">
        <button
          type="button"
          onClick={() => setIsExpanded((value) => !value)}
          aria-expanded={isExpanded}
          aria-controls={CATALOG_ID}
          className="flex items-center gap-2 rounded-full border border-warm-border bg-warm-surface px-6 py-2.5 font-mono text-xs tracking-wide text-warm-black shadow-sm transition-colors hover:bg-warm-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-accent"
        >
          <span>{isExpanded ? "Collapse Project Grid" : "Expand All Projects"}</span>
          <span
            aria-hidden
            className={cn("text-sm transition-transform", isExpanded && "rotate-180")}
          >
            ↓
          </span>
        </button>
        <span className="mt-2 font-mono text-[11px] text-warm-slate">
          Expands the carousel into the complete catalog overview
        </span>
      </div>

      {isExpanded ? <ProjectCatalog projects={projects} id={CATALOG_ID} /> : null}
    </section>
  );
}
