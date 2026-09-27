/**
 * Writing an answer into a page's controls, the way a person's typing would arrive.
 *
 * Setting `.value` is not enough on most application forms. React, Vue and friends keep their
 * own copy of every input's value and only notice a change through the events a keystroke
 * makes. So a value is written through the element prototype's own setter — which a
 * framework's per-element override cannot intercept — and then `input` and `change` are
 * dispatched, and the framework reconciles its copy against the DOM and sees the difference.
 *
 * Radios and checkboxes are clicked rather than set, for the same reason: `click()` is what a
 * framework's handler listens for, and it toggles the control as a side effect.
 *
 * A search box that only takes a value from its own list (a combobox: SuccessFactors'
 * picklists, react-select) cannot be answered by writing into it at all. Its list stays
 * empty until something is typed, and what was typed is not a value until one of the matches
 * is picked. So `fillAnswer` types — key by key, since some of these listen for keystrokes
 * rather than `input` — waits for the matches, and clicks the one the answer names.
 */

import type { Handle } from "./fields";
import type { Answer } from "./shared";

const normalise = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();

const fire = (element: Element, ...types: string[]) => {
  for (const type of types) element.dispatchEvent(new Event(type, { bubbles: true }));
};

function setNative(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
}

/** A date an answer states, as `<input type=date>` wants it. */
function isoDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}

function typeInto(element: HTMLElement, value: string): boolean {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return false;
  const text = element.type === "date" ? isoDate(value) : value;
  element.focus?.();
  setNative(element, text);
  fire(element, "input", "change");
  element.blur?.();
  return element.value === text;
}

function choose(element: HTMLElement, value: string): boolean {
  if (!(element instanceof HTMLSelectElement)) return false;
  const wanted = normalise(value);
  const option = [...element.options].find(
    (one) => normalise(one.textContent ?? "") === wanted || normalise(one.value) === wanted,
  );
  if (!option) return false;
  setNative(element, option.value);
  fire(element, "input", "change");
  return element.value === option.value;
}

/** Clicks a radio or checkbox into the wanted state, through its label if the input is hidden. */
function toggle(element: HTMLElement, on: boolean): boolean {
  if (!(element instanceof HTMLInputElement)) return false;
  if (element.checked === on) return true;

  element.click();
  if (element.checked !== on) {
    const label =
      (element.id && element.ownerDocument.querySelector<HTMLElement>(`label[for="${CSS.escape(element.id)}"]`)) ||
      element.closest("label");
    label?.click();
  }
  return element.checked === on;
}

const optionOf = (element: HTMLElement) => normalise(element.getAttribute("data-applier-option") ?? "");

/** Writes one answer into its field. True when the page now shows it. */
export function fillField(handle: Handle, answer: Answer): boolean {
  const { field, elements } = handle;
  const [first] = elements;
  if (!first) return false;

  switch (field.kind) {
    case "text":
    case "textarea":
    case "number":
    case "date":
      return typeInto(first, Array.isArray(answer) ? answer.join(", ") : answer);

    case "select":
      return choose(first, Array.isArray(answer) ? (answer[0] ?? "") : answer);

    case "file":
      return false;

    case "radio":
    case "checkbox": {
      if (field.single_checkbox) {
        const yes = normalise(Array.isArray(answer) ? (answer[0] ?? "") : answer) === "yes";
        return toggle(first, yes);
      }
      const chosen = new Set((Array.isArray(answer) ? answer : [answer]).map(normalise));
      if (field.kind === "radio") {
        const target = elements.find((element) => chosen.has(optionOf(element)));
        return target ? toggle(target, true) : false;
      }
      return elements.every((element) => toggle(element, chosen.has(optionOf(element))));
    }
  }
}

/**
 * Writes one answer into its field, waiting where the page has to answer back first. What the
 * content script calls; `fillField` is the part that needs no waiting.
 */
export async function fillAnswer(handle: Handle, answer: Answer): Promise<boolean> {
  const [first] = handle.elements;
  if (handle.field.combobox && first instanceof HTMLInputElement) {
    return pickFromSearch(first, Array.isArray(answer) ? (answer[0] ?? "") : answer);
  }
  return fillField(handle, answer);
}

/** How long a search box gets to show its matches after each attempt — or, once its list is
 * up and still empty, to fill it before the attempt counts as matching nothing. */
const LIST_WAIT_MS = 3000;
const EMPTY_WAIT_MS = 1200;
const POLL_MS = 100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Letters and digits only: "Mr." and "mr" are the same answer. */
const bare = (text: string) =>
  normalise(text)
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

function shown(element: HTMLElement): boolean {
  if (element.hidden || element.closest("[hidden], [aria-hidden=true]")) return false;
  const style = getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

/** The lists a search box shows its matches in: the ones it names, or failing that any shown. */
function listsFor(input: HTMLInputElement): HTMLElement[] {
  const doc = input.ownerDocument;
  const owner = input.closest("[role=combobox]") ?? input;
  // The input is often its own combobox; either way, each list is read once.
  const ids = new Set(
    [input, owner]
      .flatMap((element) => [element.getAttribute("aria-owns"), element.getAttribute("aria-controls")])
      .flatMap((value) => (value ?? "").split(/\s+/))
      .filter(Boolean),
  );
  const named = [...ids]
    .map((id) => doc.getElementById(id))
    .filter((element): element is HTMLElement => element !== null);
  return named.length ? named : [...doc.querySelectorAll<HTMLElement>("[role=listbox]")].filter(shown);
}

/** The matches a search box is showing. */
function matchesFor(input: HTMLInputElement): HTMLElement[] {
  return listsFor(input)
    .flatMap((list) => {
      const options = [...list.querySelectorAll<HTMLElement>("[role=option]")];
      return options.length ? options : [...list.querySelectorAll<HTMLElement>("li")];
    })
    .filter((option) => shown(option) && option.getAttribute("aria-disabled") !== "true")
    .filter((option) => bare(option.textContent ?? ""));
}

/** The match the answer names: the same words, or one of them starting with the other. */
function bestMatch(options: HTMLElement[], answer: string): HTMLElement | undefined {
  const wanted = bare(answer);
  if (!wanted) return undefined;
  const text = (option: HTMLElement) => bare(option.textContent ?? "");

  const exact = options.find((option) => text(option) === wanted);
  if (exact) return exact;

  // "Singapore" for "Singapore Citizen", "Bachelor's Degree" for "Bachelor's degree in CS" —
  // but only where exactly one option fits, so a guess is never made between two.
  const related = options.filter((option) => {
    const words = text(option);
    return words.startsWith(wanted) || wanted.startsWith(words);
  });
  return related.length === 1 ? related[0] : undefined;
}

function press(input: HTMLInputElement, key: string) {
  for (const type of ["keydown", "keyup"]) {
    input.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
  }
}

/** Types into a search box the way a person does: a key at a time. */
function typeSearch(input: HTMLInputElement, text: string) {
  input.focus();
  input.click();
  setNative(input, "");
  fire(input, "input");
  let typed = "";
  for (const character of text) {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: character, bubbles: true, cancelable: true }));
    typed += character;
    setNative(input, typed);
    input.dispatchEvent(new InputEvent("input", { bubbles: true, data: character, inputType: "insertText" }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: character, bubbles: true, cancelable: true }));
  }
}

/** Waits for the list to show something and stop changing. `listed`: whether a list came up
 * at all, empty or not — a box that never shows one is not a search box after all. */
async function settledMatches(input: HTMLInputElement): Promise<{ options: HTMLElement[]; listed: boolean }> {
  const started = Date.now();
  let last = "";
  let listed = false;
  let found: HTMLElement[] = [];
  while (Date.now() - started < LIST_WAIT_MS) {
    await sleep(POLL_MS);
    found = matchesFor(input);
    listed ||= listsFor(input).length > 0;
    const now = found.map((option) => option.textContent).join("\n");
    if (found.length && now === last) break;
    if (!found.length && listed && Date.now() - started >= EMPTY_WAIT_MS) break;
    last = now;
  }
  return { options: found, listed };
}

/** Clicks a match, with the pointer events a list that picks on mousedown listens for. */
function click(option: HTMLElement) {
  for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
    option.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
  }
  option.click();
}

const took = (input: HTMLInputElement, option: HTMLElement) =>
  bare(input.value) === bare(option.textContent ?? "") ||
  (bare(input.value) !== "" && input.getAttribute("aria-invalid") !== "true" && !matchesFor(input).length);

async function pickFromSearch(input: HTMLInputElement, answer: string): Promise<boolean> {
  const words = answer.trim().split(/\s+/);
  // The whole answer first; then less of it, for a search that matches only the start.
  const attempts = [...new Set([answer.trim(), words[0] ?? "", answer.trim().slice(0, 3)])].filter(
    (attempt) => attempt.length >= 1,
  );

  let listed = false;
  for (const attempt of attempts) {
    typeSearch(input, attempt);
    const found = await settledMatches(input);
    listed ||= found.listed;
    // Nothing came up for the whole answer: a shorter one will not bring a list either.
    if (!listed) break;
    const option = bestMatch(found.options, answer);
    if (!option) continue;

    click(option);
    await sleep(POLL_MS * 2);
    if (!took(input, option)) {
      // Some lists pick only from the keyboard: down to the match, then Enter.
      input.focus();
      const index = matchesFor(input).indexOf(option);
      for (let step = 0; step <= index; step++) press(input, "ArrowDown");
      press(input, "Enter");
      await sleep(POLL_MS * 2);
    }
    if (took(input, option)) {
      fire(input, "change");
      input.blur();
      return true;
    }
  }

  // Nothing to pick. A box that never showed a list is an ordinary text box after all; one
  // that did is left holding the answer, and reported as not filled for a person to finish.
  typeSearch(input, answer);
  fire(input, "change");
  return !listed && input.value === answer;
}

/** Puts a file into a file input, as a drop onto it would. False where a site refuses it. */
export function attachFile(handle: Handle, file: File): boolean {
  const [input] = handle.elements;
  if (!(input instanceof HTMLInputElement) || input.type !== "file") return false;

  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
  } catch {
    return false;
  }
  fire(input, "input", "change");
  return (input.files?.length ?? 0) > 0;
}

/** Whether a file input is asking for a resume, rather than a portfolio or a transcript. */
export function wantsResume(handle: Handle, onlyFileInput: boolean): boolean {
  const label = normalise(handle.field.label);
  if (/cover|transcript|portfolio|certificate|photo|picture/.test(label)) return false;
  return /resume|résumé|\bcv\b|curriculum/.test(label) || onlyFileInput;
}
