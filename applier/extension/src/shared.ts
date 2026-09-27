/**
 * What the extension's three parts say to each other.
 *
 *   content script  (every frame of every page)  reads and fills the form it is in
 *   service worker  (background.ts)              talks to `applier serve`, keeps each tab's state
 *   side panel      (panel/)                     shows it, and asks you what nothing answered
 *
 * Only the service worker ever talks to the controller: it holds the pairing key, and a
 * content script's requests would be the page's, subject to the page's own rules.
 */

export type Answer = string | string[];

export type FieldKind =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "date"
  | "file";

/** A question as `applier/src/applier/js/fields.js` reads it — the same reader a board uses. */
export interface RawField {
  id: string;
  kind: FieldKind;
  label: string;
  required: boolean;
  options: string[];
  current: string | string[] | null;
  max_length: number | null;
  members: string[];
  single_checkbox?: boolean;
  /** A search box whose value has to be picked from the list typing brings up. */
  combobox?: boolean;
}

/** Where an answer came from, as the controller reports it. */
export type Source = "fact" | "memory" | "llm" | "you" | "resume";

export interface Filled {
  frame: number;
  id: string;
  label: string;
  kind: FieldKind;
  options: string[];
  value: Answer;
  source: Source;
}

export interface Unknown {
  frame: number;
  id: string;
  label: string;
  kind: FieldKind;
  options: string[];
  required: boolean;
  maxLength: number | null;
}

/** A posting in applier's manual queue, which this tab is applying to. */
export interface Job {
  key: string;
  title: string;
  company: string | null;
  url: string;
  applyUrl: string;
  verdict: string | null;
  score: number | null;
  headline: string | null;
  hasLetter: boolean;
}

export type FrameStatus = "idle" | "reading" | "asking" | "done" | "error";

export interface FrameState {
  url: string;
  status: FrameStatus;
  error: string | null;
  filled: Filled[];
  unknown: Unknown[];
  /** Fields that could not be written into, by label: a control this does not understand. */
  failed: string[];
}

export interface TabState {
  job: Job | null;
  /** Filling on its own as the page changes: a queued job, or after Fill was pressed. */
  active: boolean;
  frames: Record<number, FrameState>;
  submitted: boolean;
}

export const emptyTab = (): TabState => ({ job: null, active: false, frames: {}, submitted: false });

/** To the service worker. */
export type Request =
  | { type: "api"; path: string; method?: string; body?: unknown }
  | { type: "hello" }
  | { type: "report"; state: FrameState }
  | { type: "resume" }
  | { type: "state"; tabId: number }
  | { type: "fill"; tabId: number }
  | { type: "submitted"; tabId: number };

/** From the service worker or the panel, to a tab's content scripts. */
export type Command =
  | { type: "fill" }
  | { type: "set"; id: string; value: Answer }
  | { type: "letter"; text: string };

/** The service worker's answer to anything: the data, or why not. */
export type Reply<T> = { ok: true; data: T } | { ok: false; error: string };

export async function ask<T>(request: Request): Promise<T> {
  const reply = (await chrome.runtime.sendMessage(request)) as Reply<T> | undefined;
  if (!reply) throw new Error("The extension's background did not answer.");
  if (!reply.ok) throw new Error(reply.error);
  return reply.data;
}

export const DEFAULT_BACKEND = "http://127.0.0.1:8765";
