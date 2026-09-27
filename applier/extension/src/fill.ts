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
