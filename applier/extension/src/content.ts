/**
 * The content script: one per frame, reading and filling the form in front of it.
 *
 * On a page from applier's manual queue (or a tab opened from one — an employer's form behind
 * a link-out) it fills on its own, and keeps filling as the form grows steps. Anywhere else it
 * waits for *Fill this page* in the side panel. Either way the controller decides every answer;
 * this only reads questions off the page and writes answers back into it, and reports what it
 * could not answer for the panel to ask.
 */

import { readPage, type Handle } from "./fields";
import { attachFile, fillField, wantsResume } from "./fill";
import {
  ask,
  type Answer,
  type Command,
  type FrameState,
  type Job,
  type RawField,
  type Source,
} from "./shared";

interface FillReply {
  answers: Record<string, Answer>;
  sources: Record<string, Source>;
  unknown: { id: string }[];
  resume: boolean;
  job: Job | null;
}

// A page that has asked the controller about fewer questions than this on its own is not
// worth a model call: a newsletter box, a search field somebody's header did not mark as one.
const MIN_FIELDS_ON_ITS_OWN = 2;
const SETTLE_MS = 900;

const frame: FrameState = {
  url: location.href,
  status: "idle",
  error: null,
  filled: [],
  unknown: [],
  failed: [],
};

const handles = new Map<string, Handle>();
// Every element already dealt with — filled, or asked about — so a growing form is only read
// for what is new in it.
let seen = new WeakSet<Element>();
let active = false;
let running = false;
let again = false;
let pass = 0;
let resumeFile: File | null | undefined;

const report = () => {
  frame.url = location.href;
  void ask({ type: "report", state: frame }).catch(() => undefined);
};

const describe = (field: RawField) => ({
  id: field.id,
  kind: field.kind,
  label: field.label,
  required: field.required,
  options: field.options,
  current: field.current,
  max_length: field.max_length,
});

async function resume(): Promise<File | null> {
  if (resumeFile !== undefined) return resumeFile;
  try {
    const found = await ask<{ name: string; type: string; data: string }>({ type: "resume" });
    const bytes = Uint8Array.from(atob(found.data), (character) => character.charCodeAt(0));
    resumeFile = new File([bytes], found.name, { type: found.type || "application/pdf" });
  } catch {
    resumeFile = null;
  }
  return resumeFile;
}

/** Reads what is new on the page, asks the controller about it, and writes back what it says. */
async function fill(options: { onItsOwn: boolean }): Promise<void> {
  if (running) {
    again = true;
    return;
  }
  running = true;

  try {
    const fresh = readPage(document, `x${pass++}_`).filter(
      (handle) => !handle.elements.some((element) => seen.has(element)),
    );
    if (!fresh.length) return;
    const started = frame.filled.length + frame.unknown.length > 0;
    if (options.onItsOwn && !started && fresh.length < MIN_FIELDS_ON_ITS_OWN) return;

    for (const handle of fresh) {
      handles.set(handle.field.id, handle);
      handle.elements.forEach((element) => seen.add(element));
    }

    frame.status = "reading";
    frame.error = null;
    report();

    const questions = fresh.filter((handle) => handle.field.kind !== "file");
    const reply = await ask<FillReply>({
      type: "api",
      path: "/api/ext/fill",
      method: "POST",
      body: {
        url: location.href,
        title: document.title,
        fields: questions.map((handle) => describe(handle.field)),
      },
    });

    for (const [id, value] of Object.entries(reply.answers)) {
      const handle = handles.get(id);
      if (!handle) continue;
      record(handle, value, reply.sources[id] ?? "llm", fillField(handle, value));
    }

    const unknown = new Set(reply.unknown.map((one) => one.id));
    for (const handle of questions) {
      if (!unknown.has(handle.field.id)) continue;
      frame.unknown.push({
        frame: 0,
        id: handle.field.id,
        label: handle.field.label,
        kind: handle.field.kind,
        options: handle.field.options,
        required: handle.field.required,
        maxLength: handle.field.max_length,
      });
    }

    const files = fresh.filter((handle) => handle.field.kind === "file");
    const onlyOne = document.querySelectorAll("input[type=file]").length === 1;
    for (const handle of files) {
      if (!reply.resume || !wantsResume(handle, onlyOne)) continue;
      const file = await resume();
      if (file) record(handle, file.name, "resume", attachFile(handle, file));
    }

    frame.status = frame.unknown.length ? "asking" : "done";
  } catch (error) {
    frame.status = "error";
    frame.error = error instanceof Error ? error.message : String(error);
  } finally {
    running = false;
    report();
    if (again) {
      again = false;
      void fill({ onItsOwn: true });
    }
  }
}

function record(handle: Handle, value: Answer, source: Source, ok: boolean) {
  const { field } = handle;
  frame.filled = frame.filled.filter((one) => one.id !== field.id);
  frame.unknown = frame.unknown.filter((one) => one.id !== field.id);
  frame.failed = frame.failed.filter((label) => label !== field.label);

  if (!ok) {
    frame.failed.push(field.label || field.id);
    return;
  }
  frame.filled.push({
    frame: 0,
    id: field.id,
    label: field.label,
    kind: field.kind,
    options: field.options,
    value,
    source,
  });
}

function insertLetter(text: string): boolean {
  const boxes = [...document.querySelectorAll<HTMLTextAreaElement>("textarea")];
  const labelled = [...handles.values()].find(
    (handle) => handle.field.kind === "textarea" && /cover|letter|motivation/i.test(handle.field.label),
  );
  const focused = document.activeElement instanceof HTMLTextAreaElement ? document.activeElement : null;
  const target = labelled?.elements[0] ?? focused ?? (boxes.length === 1 ? boxes[0] : null);
  if (!target) return false;

  const handle: Handle = labelled ?? {
    field: {
      id: "letter",
      kind: "textarea",
      label: "Cover letter",
      required: false,
      options: [],
      current: null,
      max_length: null,
      members: [],
    },
    elements: [target],
  };
  const ok = fillField(handle, text);
  record(handle, text, "you", ok);
  report();
  return ok;
}

let settle: number | undefined;
const watcher = new MutationObserver(() => {
  if (!active) return;
  window.clearTimeout(settle);
  settle = window.setTimeout(() => void fill({ onItsOwn: true }), SETTLE_MS);
});

function activate() {
  if (active) return;
  active = true;
  watcher.observe(document.documentElement, { childList: true, subtree: true });
}

chrome.runtime.onMessage.addListener((command: Command, _sender, reply) => {
  switch (command.type) {
    case "fill":
      // Pressed by a person: everything on the page is read again, from the top.
      seen = new WeakSet();
      frame.filled = [];
      frame.unknown = [];
      frame.failed = [];
      activate();
      void fill({ onItsOwn: false }).then(() => reply({ ok: true }));
      return true;

    case "set": {
      const handle = handles.get(command.id);
      if (!handle) return false;
      const ok = fillField(handle, command.value);
      record(handle, command.value, "you", ok);
      frame.status = frame.unknown.length ? "asking" : "done";
      report();
      reply({ ok });
      return false;
    }

    case "letter":
      if (window !== window.top && !document.querySelector("textarea")) return false;
      reply({ ok: insertLetter(command.text) });
      return false;
  }
});

async function start() {
  try {
    const hello = await ask<{ active: boolean }>({ type: "hello" });
    if (hello.active) {
      activate();
      await fill({ onItsOwn: true });
    }
  } catch {
    // Not paired yet, or the controller is not running: the panel says which.
  }
}

void start();
