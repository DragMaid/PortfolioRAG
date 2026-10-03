/** Sorting the tables, and remembering how each one was last sorted and filtered. */

import type { DataTableSortStatus } from "mantine-datatable";
import { useEffect, useState } from "react";

import type { Job, Verdict } from "./types";
import { DONE, waitsOnYou } from "./types";

const VERDICT_RANK: Record<Verdict, number> = { weak: 0, partial: 1, promising: 2, strong: 3 };

/** A fit as one number: the score, with the verdict breaking ties. Unassessed sorts last. */
export const fitRank = (verdict: Verdict | null, score: number | null) =>
  verdict == null && score == null ? -1 : (score ?? 0) * 10 + (verdict ? VERDICT_RANK[verdict] : 0);

/** Waiting on you first, then still moving, then done — the order the server sends. */
export const stateRank = (job: Pick<Job, "state" | "hasReport">) =>
  waitsOnYou(job) ? 0 : DONE.has(job.state) ? 2 : 1;

/** Sorts a copy by what `key` reads off each row. */
export function sortBy<T, K extends string>(
  rows: T[],
  status: DataTableSortStatus<T>,
  keys: Record<K, (row: T) => string | number>,
): T[] {
  const key = keys[status.columnAccessor as K];
  if (!key) return rows;
  const sign = status.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const [x, y] = [key(a), key(b)];
    const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return order * sign;
  });
}

/**
 * State kept in this browser between visits: a table's sort and filters are a preference, not
 * something the controller needs to know. Storage can be missing or refuse; the default wins.
 */
export function useRemembered<T>(name: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(`applier.${name}`);
      return saved ? { ...initial, ...JSON.parse(saved) } : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`applier.${name}`, JSON.stringify(value));
    } catch {
      // Private window, or storage blocked: it just is not remembered.
    }
  }, [name, value]);

  return [value, setValue];
}
