/**
 * Reading a form's questions — with the very reader the board adapters use.
 *
 * `applier/src/applier/js/fields.js` is one function expression, evaluated by Playwright in a
 * board's page. The build turns that same file into a module (see `build.mjs`), so a form is
 * read into exactly the fields the controller's answerer already knows how to answer, and a
 * fix to the reader is a fix in both places.
 */

// @ts-expect-error — plain JS, made a module by the build and by vitest.config.ts.
import readFields from "../../src/applier/js/fields.js";

import type { RawField } from "./shared";

/** A field, and the elements that make it up — held directly, not by attribute. */
export interface Handle {
  field: RawField;
  elements: HTMLElement[];
}

/** Where a form's questions are not: the site's own search box, its navigation, its header. */
const CHROME = "header, nav, footer, [role=search], [role=navigation], [role=banner]";

/**
 * Every question on the page, in document order, each with its elements.
 *
 * The reader tags each control with `data-applier-field`; the tags are read straight back into
 * element references, because a later read (a form that grew a step) re-tags everything.
 */
export function readPage(root: ParentNode, prefix: string): Handle[] {
  const raw = readFields(root, prefix) as RawField[];
  const handles: Handle[] = [];

  for (const field of raw) {
    const elements = field.members
      .map((member) => root.querySelector<HTMLElement>(`[data-applier-field="${member}"]`))
      .filter((element): element is HTMLElement => element !== null);
    if (!elements.length || elements.every((element) => element.closest(CHROME))) continue;
    handles.push({ field, elements });
  }

  return handles;
}
