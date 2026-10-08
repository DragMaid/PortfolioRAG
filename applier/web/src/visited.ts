/**
 * Which postings you have opened from here, so a row you have already looked at reads as one.
 *
 * Kept in this browser, like the tables' sort: it is a reading aid, not a record. What you
 * applied to is the record, and that is the ledger's — the *Applied* tick.
 */

import { useSyncExternalStore } from "react";

const STORAGE = "applier.visited";

function read(): Set<string> {
  try {
    const saved = localStorage.getItem(STORAGE);
    return new Set(saved ? (JSON.parse(saved) as string[]) : []);
  } catch {
    return new Set();
  }
}

let visited = read();
const listeners = new Set<() => void>();

export function markVisited(key: string) {
  if (visited.has(key)) return;
  visited = new Set(visited).add(key);
  try {
    localStorage.setItem(STORAGE, JSON.stringify([...visited]));
  } catch {
    // Private window, or storage blocked: it lasts until the page is reloaded.
  }
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The keys of every posting opened from either table, updating as more are. */
export const useVisited = () => useSyncExternalStore(subscribe, () => visited);
