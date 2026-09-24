"use client";

import { useCallback, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "./themeScript";

export type ThemePreference = "light" | "dark";
export type Theme = "light" | "dark";

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" ? value : "dark"
  } catch {
    return "light";
  }
}

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** Fires on every change to `data-theme`, whoever made it: the toggle, the OS, another tab. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** The theme actually on screen. Light during server rendering. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "light");
}

/** The visitor's preference, and a setter that applies and remembers it. */
export function useThemePreference() {
  // The preference only changes alongside `data-theme`
  // so the same subscription covers it.
  const preference = useSyncExternalStore(subscribe, readPreference, () => "light" as const);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked: the choice still applies for this page view.
    }
    const dark = next === "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, []);

  return { preference, setPreference };
}
