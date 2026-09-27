/**
 * The side panel: pairing with applier, what was filled on this tab, and what nothing answered.
 *
 * Pairing lives at the top, and nothing below it can be pressed until applier answers: every
 * other control sits in one `<fieldset>` that is disabled while it does not.
 *
 * Every unanswered question is asked with the same choices the page offers — a question with
 * options is a list of them to pick from, never a box to type into — and *Save* fills the page
 * with the answer. With *Remember* ticked (the default) it is kept by applier, and the next
 * form anywhere that asks the same question — here, or on a board's own form during a run —
 * is answered with it without asking.
 *
 * `panel.html?tab=<id>` pins the panel to one tab, which is how the end-to-end test opens it.
 */

import {
  ask,
  DEFAULT_BACKEND,
  type Answer,
  type Command,
  type Filled,
  type TabState,
  type Unknown,
} from "../shared";

interface Status {
  ok: boolean;
  model: string;
  candidate: string;
  resume: boolean;
  remembered: number;
  manual: number;
}

const app = document.getElementById("app") as HTMLElement;
const pinned = Number(new URLSearchParams(location.search).get("tab")) || null;

let tabId: number | null = pinned;
let state: TabState | null = null;
let status: Status | null = null;
/** Why applier did not answer the last status check. */
let offline: string | null = null;
/** Why the last thing pressed did not work. */
let problem: string | null = null;
let busy = false;
let pairing = false;
let editing: string | null = null;
let stored = { backend: DEFAULT_BACKEND, key: "" };

/** More options than this is too long a list to lay out: it stays a dropdown. */
const MAX_LISTED = 8;

const key = (one: { frame: number; id: string }) => `${one.frame}:${one.id}`;
const connected = () => status?.ok === true;
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: (Node | string | null | false | undefined)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (value === undefined || value === false || value === null) continue;
    if (name.startsWith("on") && typeof value === "function") {
      element.addEventListener(name.slice(2).toLowerCase(), value as EventListener);
    } else if (name === "className") {
      element.className = String(value);
    } else {
      element.setAttribute(name, value === true ? "" : String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === false || child === undefined) continue;
    element.append(child);
  }
  return element;
}

async function currentTab(): Promise<number | null> {
  if (pinned) return pinned;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id ?? null;
}

async function refresh() {
  tabId = await currentTab();
  const saved = await chrome.storage.local.get(["backend", "key"]);
  stored = { backend: String(saved.backend || DEFAULT_BACKEND), key: String(saved.key || "") };
  try {
    status = await ask<Status>({ type: "api", path: "/api/ext/status" });
    offline = null;
  } catch (error) {
    status = null;
    offline = message(error);
  }
  state = tabId === null ? null : await ask<TabState>({ type: "state", tabId });
  render();
}

function send(command: Command, frameId?: number): Promise<{ ok: boolean } | undefined> {
  if (tabId === null) return Promise.resolve(undefined);
  return chrome.tabs.sendMessage(tabId, command, frameId === undefined ? undefined : { frameId });
}

async function run(work: () => Promise<unknown>) {
  busy = true;
  render(true);
  try {
    await work();
    problem = null;
  } catch (error) {
    problem = message(error);
  } finally {
    busy = false;
    render(true);
  }
}

// --- pairing ------------------------------------------------------------------

/** Tests an address and key against applier, and keeps them only if it answers. */
async function pair(backend: string, secret: string) {
  const address = (backend.trim() || DEFAULT_BACKEND).replace(/\/+$/, "");
  let response: Response;
  try {
    response = await fetch(`${address}/api/ext/status`, { headers: { "X-Applier-Key": secret.trim() } });
  } catch {
    throw new Error(`Nothing answered at ${address}. Is applier serve running?`);
  }
  if (response.status === 401) throw new Error("applier does not know that key.");
  if (!response.ok) throw new Error(`applier answered ${response.status}.`);
  await chrome.storage.local.set({ backend: address, key: secret.trim() });
  pairing = false;
  await refresh();
}

function pairForm(): HTMLElement {
  const backend = h("input", {
    id: "backend",
    type: "url",
    value: stored.backend,
    placeholder: DEFAULT_BACKEND,
    spellcheck: "false",
  });
  const secret = h("input", {
    id: "key",
    type: "password",
    value: stored.key,
    placeholder: "ext_…",
    autocomplete: "off",
  });
  return h(
    "form",
    {
      className: "pair",
      onsubmit: (event: Event) => {
        event.preventDefault();
        void run(() => pair(backend.value, secret.value));
      },
    },
    h("label", { className: "field" }, h("span", {}, "Controller address"), backend),
    h("label", { className: "field" }, h("span", {}, "Pairing key"), secret),
    h(
      "p",
      { className: "hint" },
      "Both are on the ",
      h("b", {}, "Browser extension"),
      " card of the page ",
      h("code", {}, "applier serve"),
      " opens.",
    ),
    h(
      "div",
      { className: "row" },
      h("button", { type: "submit", className: "primary", disabled: busy }, busy ? "Connecting…" : "Connect"),
      connected() &&
        h(
          "button",
          { type: "button", className: "quiet", onclick: () => ((pairing = false), (problem = null), render(true)) },
          "Cancel",
        ),
    ),
  );
}

function connection(): HTMLElement {
  const ok = connected();
  const open = !ok || pairing;
  const why = open ? (problem ?? (stored.key ? offline : null)) : null;
  return h(
    "section",
    { className: `connection ${ok ? "is-ok" : "is-off"}` },
    h(
      "div",
      { className: "row spread" },
      h(
        "div",
        { className: "row tight" },
        h("span", { className: `dot ${ok ? "ok" : stored.key ? "bad" : ""}` }),
        h("strong", {}, ok ? "Connected to applier" : stored.key ? "Can't reach applier" : "Connect to applier"),
      ),
      ok &&
        !pairing &&
        h("button", { className: "quiet", onclick: () => ((pairing = true), render(true)) }, "Change"),
    ),
    ok &&
      status &&
      h(
        "p",
        { className: "meta" },
        [status.candidate, `${status.remembered} remembered`, status.resume ? "resume ready" : "no resume set", status.model]
          .filter(Boolean)
          .join(" · "),
      ),
    why && h("p", { className: "error", role: "alert" }, why),
    open && pairForm(),
  );
}

// --- answering ----------------------------------------------------------------

const asList = (value: Answer | undefined): string[] =>
  value === undefined || value === "" ? [] : Array.isArray(value) ? value : [value];

/** The page's own choices, to pick from: radios for one answer, boxes for several. */
function choices(field: Unknown | Filled, name: string, multiple: boolean, current: Answer | undefined) {
  const chosen = new Set(asList(current));
  const short = !multiple && field.options.length <= 3 && field.options.every((option) => option.length <= 14);
  return h(
    "div",
    {
      className: short ? "choices inline" : "choices",
      role: multiple ? "group" : "radiogroup",
      "aria-label": field.label,
    },
    ...field.options.map((option) =>
      h(
        "label",
        { className: "choice" },
        h("input", { type: multiple ? "checkbox" : "radio", name, value: option, checked: chosen.has(option) }),
        h("span", {}, option),
      ),
    ),
  );
}

function control(field: Unknown | Filled, current?: Answer): HTMLElement {
  const name = `answer-${key(field)}`;
  const value = current ?? "";
  const single = field.kind === "radio" || field.kind === "select";

  if (field.kind === "checkbox" && field.options.length) return choices(field, name, true, current);
  if (single && field.options.length && field.options.length <= MAX_LISTED) {
    return choices(field, name, false, current);
  }
  if (single && field.options.length) {
    return h(
      "select",
      { name, "aria-label": field.label },
      h("option", { value: "" }, "Choose…"),
      ...field.options.map((option) => h("option", { value: option, selected: option === value }, option)),
    );
  }
  if (field.kind === "textarea") {
    const limit = "maxLength" in field ? (field.maxLength ?? undefined) : undefined;
    return h("textarea", { name, "aria-label": field.label, maxlength: limit, rows: 3 }, String(value));
  }
  return h("input", {
    name,
    "aria-label": field.label,
    type: field.kind === "number" ? "number" : field.kind === "date" ? "date" : "text",
    value: Array.isArray(value) ? value.join(", ") : value,
  });
}

function read(form: HTMLElement, field: Unknown | Filled): Answer {
  const boxes = [...form.querySelectorAll<HTMLInputElement>(".choices input")];
  if (boxes.length) {
    const picked = boxes.filter((box) => box.checked).map((box) => box.value);
    return field.kind === "checkbox" ? picked : (picked[0] ?? "");
  }
  const input = form.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    "input[name^=answer], textarea, select",
  );
  return input?.value.trim() ?? "";
}

async function answer(field: Unknown | Filled, value: Answer, remember: boolean) {
  if (value === "" || (Array.isArray(value) && !value.length)) {
    throw new Error(field.options.length ? `Pick an answer for “${field.label}” first.` : "Type an answer first.");
  }
  if (remember) {
    await ask({
      type: "api",
      path: "/api/ext/remember",
      method: "POST",
      body: {
        field: { id: field.id, kind: field.kind, label: field.label, options: field.options },
        answer: value,
      },
    });
  }
  const reply = await send({ type: "set", id: field.id, value }, field.frame);
  if (!reply?.ok) throw new Error(`Could not write that into “${field.label}” on the page.`);
  editing = null;
}

function answerForm(field: Unknown | Filled, current?: Answer): HTMLElement {
  const remember = h("input", { type: "checkbox", checked: true, name: "remember" });
  const form = h(
    "form",
    {
      className: "answer",
      onsubmit: (event: Event) => {
        event.preventDefault();
        void run(() => answer(field, read(form, field), remember.checked));
      },
    },
    control(field, current),
    h(
      "div",
      { className: "row spread" },
      h("label", { className: "check" }, remember, "Remember"),
      h(
        "div",
        { className: "row tight" },
        editing === key(field) &&
          h("button", { type: "button", className: "quiet", onclick: () => ((editing = null), render(true)) }, "Cancel"),
        h("button", { type: "submit", className: "primary", disabled: busy }, "Save"),
      ),
    ),
  );
  return form;
}

// --- drawing --------------------------------------------------------------------

function jobCard(current: TabState): HTMLElement | null {
  const job = current.job;
  if (!job) return null;
  return h(
    "section",
    { className: "job" },
    h("p", { className: "job-title" }, job.title || job.key),
    h(
      "p",
      { className: "meta" },
      [job.company, job.verdict && `${job.verdict} ${job.score ?? ""}`.trim()].filter(Boolean).join(" · "),
    ),
    job.headline && h("p", { className: "headline" }, job.headline),
    h(
      "div",
      { className: "row" },
      job.hasLetter &&
        h(
          "button",
          {
            disabled: busy,
            onclick: () =>
              void run(async () => {
                const { letter } = await ask<{ letter: string }>({
                  type: "api",
                  path: `/api/ext/jobs/${encodeURIComponent(job.key)}/letter`,
                });
                await navigator.clipboard.writeText(letter).catch(() => undefined);
                const reply = await send({ type: "letter", text: letter }).catch(() => undefined);
                if (!reply?.ok) throw new Error("Letter copied. Click into the letter box and paste it.");
              }),
          },
          "Insert cover letter",
        ),
      current.submitted
        ? h("span", { className: "tag memory" }, "recorded as sent")
        : h(
            "button",
            {
              className: "good",
              disabled: busy,
              onclick: () => void run(() => ask({ type: "submitted", tabId: tabId as number })),
            },
            "I sent it",
          ),
    ),
  );
}

function fillBar(current: TabState | null, filled: Filled[], unknown: Unknown[], reading: boolean): HTMLElement {
  const summary = reading
    ? "Reading the form…"
    : filled.length || unknown.length
      ? `${filled.length} filled · ${unknown.length} to answer`
      : current?.active
        ? "Watching for a form"
        : "Nothing filled yet";
  return h(
    "div",
    { className: "fill row spread" },
    h(
      "div",
      { className: "row tight" },
      h("span", { className: `dot ${reading || busy ? "busy" : filled.length ? "ok" : ""}` }),
      h("span", {}, summary),
    ),
    h(
      "button",
      {
        className: "primary",
        id: "fill",
        disabled: busy || tabId === null,
        onclick: () => void run(() => ask({ type: "fill", tabId: tabId as number })),
      },
      "Fill this page",
    ),
  );
}

function unknownList(unknown: Unknown[]): HTMLElement | null {
  if (!unknown.length) return null;
  return h(
    "section",
    {},
    h("h2", {}, "Needs you ", h("span", { className: "count" }, String(unknown.length))),
    h(
      "ul",
      { className: "questions" },
      ...unknown.map((field) =>
        h(
          "li",
          { "data-field": field.id },
          h(
            "p",
            { className: "question" },
            field.label || field.id,
            field.required && h("span", { className: "required", title: "Required" }, "required"),
          ),
          answerForm(field),
        ),
      ),
    ),
  );
}

const SOURCE: Record<string, string> = {
  fact: "your details",
  memory: "remembered",
  llm: "from your facts",
  you: "you",
  resume: "resume",
};

function filledList(filled: Filled[]): HTMLElement | null {
  if (!filled.length) return null;
  return h(
    "section",
    {},
    h("h2", {}, "Filled ", h("span", { className: "count" }, String(filled.length))),
    h(
      "ul",
      { className: "filled" },
      ...filled.map((field) => {
        const changeable = field.source !== "resume";
        const open = changeable && editing === key(field);
        return h(
          "li",
          { className: open ? "open" : undefined },
          h(
            "div",
            { className: "row spread top" },
            h("span", { className: "question" }, field.label || field.id),
            h("span", { className: `tag ${field.source}` }, SOURCE[field.source] ?? field.source),
          ),
          open
            ? answerForm(field, field.value)
            : h(
                "div",
                { className: "row spread top" },
                h("span", { className: "value" }, asList(field.value).join(", ")),
                changeable &&
                  h(
                    "button",
                    {
                      className: "quiet",
                      "aria-label": `Change ${field.label}`,
                      onclick: () => ((editing = key(field)), render(true)),
                    },
                    "Change",
                  ),
              ),
        );
      }),
    ),
  );
}

function render(force = false) {
  // Keep what is being typed: redrawing mid-answer would throw it away.
  const focused = document.activeElement;
  const typing = app.contains(focused) && focused?.closest("form.answer, form.pair");
  if (typing && !force) return;

  const current = state;
  const frames = Object.values(current?.frames ?? {});
  const unknown = frames.flatMap((frame) => frame.unknown);
  const filled = frames.flatMap((frame) => frame.filled);
  const failed = frames.flatMap((frame) => frame.failed);
  const reading = frames.some((frame) => frame.status === "reading");
  const errors = frames.map((frame) => frame.error).filter(Boolean);
  const ok = connected();

  const work = h(
    "fieldset",
    { className: "work", disabled: !ok, "aria-label": "This page" },
    current ? jobCard(current) : null,
    h(
      "section",
      {},
      fillBar(current, filled, unknown, reading),
      ok && !pairing && problem && h("p", { className: "error", role: "alert" }, problem),
      ...errors.map((error) => h("p", { className: "error" }, String(error))),
      failed.length > 0 && h("p", { className: "hint" }, `Couldn't write into ${failed.join("; ")}. Fill those by hand.`),
    ),
    unknownList(unknown),
    filledList(filled),
  );

  app.replaceChildren(connection(), work);
}

chrome.runtime.onMessage.addListener((incoming: { type: string; tabId: number; state: TabState }) => {
  if (incoming.type === "state" && incoming.tabId === tabId) {
    state = incoming.state;
    render();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.backend || changes.key)) void refresh();
});

if (!pinned) {
  chrome.tabs.onActivated.addListener(() => void refresh());
  chrome.tabs.onUpdated.addListener((updated, change) => {
    if (updated === tabId && change.status === "complete") void refresh();
  });
}

void refresh();
