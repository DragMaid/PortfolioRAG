"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExperienceDetail } from "@/components/experience/ExperienceDetail";
import { RoleCard } from "@/components/experience/RoleCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { ExperienceEntry } from "@/lib/types";

const PANEL_ID = "experience-panel";

/** Where on the screen the thread's lit end sits: a little above the middle, where the eye reads. */
const READING_LINE = 0.55;

/**
 * The career as a thread of light.
 *
 * Roles hang down a vertical thread, newest first. As the reader scrolls, light travels
 * down it and each company mark lights as the light reaches it — and the role it last
 * reached is the one the write-up beside it shows. Clicking a card or tabbing to it
 * shows that role instead, until the light reaches the next one.
 *
 * The light is measured, not a CSS scroll timeline: it has to arrive at a node exactly
 * when the node crosses the reading line, and a view-timeline range cannot express a
 * point that depends on the list's own height. The loop runs only while the section is on
 * screen, and writes one custom property — React hears about it only when a node is reached.
 */
export function ExperienceSection({ entries }: { entries: ExperienceEntry[] }) {
  /* The API gives the career oldest first; a reader wants where the person is now. */
  const roles = [...entries].reverse();
  const count = roles.length;

  const [activeIndex, setActiveIndex] = useState(0);
  const [litCount, setLitCount] = useState(count);

  const threadRef = useRef<HTMLOListElement>(null);
  const nodeRefs = useRef<(HTMLElement | null)[]>([]);
  const litRef = useRef(count);

  const registerNode = useCallback(
    (index: number) => (element: HTMLElement | null) => {
      nodeRefs.current[index] = element;
    },
    [],
  );

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread || count === 0) return;

    // Asked for stillness: the thread is simply lit, end to end.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      thread.style.setProperty("--lit", "1");
      return;
    }

    let frame = 0;

    const measure = () => {
      frame = 0;
      const box = thread.getBoundingClientRect();
      const reading = window.innerHeight * READING_LINE;
      const progress = Math.min(1, Math.max(0, (reading - box.top) / box.height));
      thread.style.setProperty("--lit", progress.toFixed(4));

      let lit = 0;
      for (const node of nodeRefs.current) {
        if (node && node.getBoundingClientRect().top + node.offsetHeight / 2 <= reading) lit += 1;
      }

      if (lit !== litRef.current) {
        litRef.current = lit;
        setLitCount(lit);
        // The light moved onto another role: follow it, whichever way the reader is going.
        setActiveIndex(Math.max(0, lit - 1));
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    // Only listen while the thread could be seen.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          window.addEventListener("scroll", schedule, { passive: true });
          window.addEventListener("resize", schedule);
          schedule();
        } else {
          window.removeEventListener("scroll", schedule);
          window.removeEventListener("resize", schedule);
        }
      },
      { rootMargin: "25% 0px" },
    );

    observer.observe(thread);
    measure();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, [count]);

  if (count === 0) return null;

  const active = roles[activeIndex] ?? roles[0];

  return (
    <section id="experience" className="scroll-mt-24">
      <SectionHeading
        eyebrow="02 / Experience"
        title="Career Trajectory & Systems Built"
        className="mb-12"
      />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
        <ol
          ref={threadRef}
          aria-label="Career, most recent first"
          className="thread relative space-y-6 lg:col-span-6 lg:space-y-10 lg:py-6"
          style={{ "--lit": 1 } as React.CSSProperties}
        >
          {/* The unlit thread, and the light travelling down it. */}
          <span aria-hidden className="thread-rail" />
          <span aria-hidden className="thread-light" />
          <span aria-hidden className="thread-spark" />

          {roles.map((entry, index) => (
            <RoleCard
              key={entry.id}
              ref={registerNode(index)}
              entry={entry}
              isLit={index < litCount}
              isActive={index === activeIndex}
              isCurrent={index === 0}
              onSelect={() => setActiveIndex(index)}
              panelId={PANEL_ID}
            />
          ))}
        </ol>

        {/* Desktop only: the write-up of the role the light is on, held in view beside the thread.
            Small screens read each role's write-up inside its own card instead. */}
        <div className="hidden lg:col-span-6 lg:block">
          <div className="sticky top-28">
            <ExperienceDetail entry={active} panelId={PANEL_ID} />
          </div>
        </div>
      </div>
    </section>
  );
}
