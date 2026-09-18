"use client";

import { useEffect, useRef, useState } from "react";

type RevealState = "static" | "waiting" | "shown";

/**
 * Lifts a section into place the first time it scrolls into view.
 *
 * The server renders it visible, and only a section that is still below the fold once the
 * page is interactive is held back — so nothing is hidden if the script never runs, a
 * section already on screen never blinks, and a reader who asked for reduced motion gets
 * the page as it is. The staggering of a section's parts lives in globals.css.
 */
export function Reveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RevealState>("static");

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Already on screen (a short page, a reload part-way down, a #hash): leave it be.
    if (element.getBoundingClientRect().top < window.innerHeight * 0.9) return;

    setState("waiting");

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setState("shown");
        observer.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-reveal={state} className="reveal">
      {children}
    </div>
  );
}
