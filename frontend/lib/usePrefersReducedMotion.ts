"use client";

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Tracks the OS "reduce motion" setting.
 *
 * Starts `false` so server and first client render agree, then syncs in an
 * effect. Callers use it to suppress autoplay and smooth scrolling, which CSS
 * alone cannot switch off.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const sync = () => setPrefersReducedMotion(media.matches);

    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return prefersReducedMotion;
}
