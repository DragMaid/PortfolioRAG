"use client";

import { useCallback, useRef } from "react";

/**
 * Arrow-key navigation for a `role="tablist"`, with automatic activation.
 *
 * Only the selected tab is reachable with Tab; the arrow keys move focus and
 * selection together, wrapping at both ends.
 */
export function useRovingTabList(
  count: number,
  onSelect: (index: number) => void,
) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = useCallback(
    (index: number) => {
      const next = ((index % count) + count) % count;
      onSelect(next);
      refs.current[next]?.focus();
    },
    [count, onSelect],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          move(index + 1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          move(index - 1);
          break;
        case "Home":
          event.preventDefault();
          move(0);
          break;
        case "End":
          event.preventDefault();
          move(count - 1);
          break;
        default:
          break;
      }
    },
    [count, move],
  );

  const registerRef = useCallback(
    (index: number) => (element: HTMLButtonElement | null) => {
      refs.current[index] = element;
    },
    [],
  );

  /* `refs` is exposed so callers can also measure or scroll the items. */
  return { registerRef, onKeyDown, refs };
}
