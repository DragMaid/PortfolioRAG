/**
 * The service worker: the one part that talks to `applier serve`, and the keeper of each tab's
 * state.
 *
 * **Following a link-out.** A posting in the manual queue that links out opens on the board's
 * own page, and its *Apply* button opens the employer's form in a new tab — at an address
 * applier has never seen. A tab opened from a tab that is applying to a job inherits that job,
 * so the employer's form is filled, and *I sent it* settles the right posting.
 *
 * State lives in `chrome.storage.session`, because a service worker is stopped whenever Chrome
 * likes and loses everything in memory when it is.
 */

import {
  DEFAULT_BACKEND,
  emptyTab,
  type Command,
  type FrameState,
  type Job,
  type Reply,
  type Request,
  type TabState,
} from "./shared";

async function settings(): Promise<{ backend: string; key: string }> {
  const stored = await chrome.storage.local.get(["backend", "key"]);
  const backend = String(stored.backend || DEFAULT_BACKEND).replace(/\/+$/, "");
  return { backend, key: String(stored.key || "") };
}

async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const { backend, key } = await settings();
  if (!key) throw new Error("Not paired yet. Connect to applier in the side panel.");

  let response: Response;
  try {
    response = await fetch(backend + path, {
      method,
      headers: {
        "X-Applier-Key": key,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(`Cannot reach applier at ${backend}. Is applier serve running?`);
  }

  if (!response.ok) {
    let detail = `applier answered ${response.status}`;
    try {
      detail = (await response.json())?.detail ?? detail;
    } catch {
      /* not JSON: the status says as much as there is */
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return (await response.json()) as T;
}

// --- tab state ----------------------------------------------------------------

const slot = (tabId: number) => `tab:${tabId}`;

async function load(tabId: number): Promise<TabState> {
  const stored = await chrome.storage.session.get(slot(tabId));
  return (stored[slot(tabId)] as TabState | undefined) ?? emptyTab();
}

async function save(tabId: number, state: TabState): Promise<void> {
  await chrome.storage.session.set({ [slot(tabId)]: state });
  // The panel listens; with no panel open there is nobody to tell, which is fine.
  chrome.runtime.sendMessage({ type: "state", tabId, state }).catch(() => undefined);
}

// Frames report at once, and each report is a read and a write: one tab's updates go through
// one at a time, or two frames' findings overwrite each other.
const queues = new Map<number, Promise<unknown>>();

function withTab<T>(tabId: number, work: (state: TabState) => Promise<T>): Promise<T> {
  const previous = queues.get(tabId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(async () => {
    const state = await load(tabId);
    const result = await work(state);
    await save(tabId, state);
    return result;
  });
  queues.set(tabId, next);
  return next;
}

async function jobFor(url: string): Promise<Job | null> {
  if (!/^https?:/.test(url)) return null;
  const found = await call<{ job: Job | null }>(`/api/ext/job?url=${encodeURIComponent(url)}`);
  return found.job;
}

// --- messages ---------------------------------------------------------------

async function handle(request: Request, sender: chrome.runtime.MessageSender): Promise<unknown> {
  const tabId = sender.tab?.id;

  switch (request.type) {
    case "api":
      return call(request.path, request.method, request.body);

    case "hello": {
      if (tabId === undefined) return { active: false };
      const opener = sender.tab?.openerTabId;
      return withTab(tabId, async (state) => {
        // A frame starting over is a new page: whatever the last one found is gone with it.
        if (sender.frameId === 0) state.frames = {};
        if (!state.job && opener !== undefined) {
          const parent = await load(opener);
          if (parent.job && !parent.submitted) state.job = parent.job;
        }
        if (!state.job) {
          try {
            state.job = await jobFor(sender.tab?.url ?? "");
          } catch {
            state.job = null;
          }
        }
        state.active ||= state.job !== null && !state.submitted;
        return { active: state.active };
      });
    }

    case "report": {
      if (tabId === undefined) return null;
      const frameId = sender.frameId ?? 0;
      const frame: FrameState = {
        ...request.state,
        filled: request.state.filled.map((one) => ({ ...one, frame: frameId })),
        unknown: request.state.unknown.map((one) => ({ ...one, frame: frameId })),
      };
      return withTab(tabId, async (state) => {
        state.frames[frameId] = frame;
        return null;
      });
    }

    case "resume": {
      const { backend, key } = await settings();
      const response = await fetch(`${backend}/api/ext/resume`, { headers: { "X-Applier-Key": key } });
      if (!response.ok) throw new Error("No resume file is set in applier.");
      const disposition = response.headers.get("content-disposition") ?? "";
      const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1] ?? "resume.pdf";
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let at = 0; at < bytes.length; at += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
      }
      return {
        name: decodeURIComponent(name),
        type: response.headers.get("content-type") ?? "application/pdf",
        data: btoa(binary),
      };
    }

    case "state":
      return load(request.tabId);

    case "fill": {
      await withTab(request.tabId, async (state) => {
        state.active = true;
        state.frames = {};
      });
      // Every frame: an application form is often an embed from an applicant-tracking site.
      await chrome.tabs.sendMessage(request.tabId, { type: "fill" } satisfies Command);
      return null;
    }

    case "submitted":
      return withTab(request.tabId, async (state) => {
        if (!state.job) throw new Error("This tab is not applying to a posting from applier.");
        await call(`/api/ext/jobs/${encodeURIComponent(state.job.key)}/submitted`, "POST");
        state.submitted = true;
        state.active = false;
        return null;
      });
  }
}

chrome.runtime.onMessage.addListener((request: Request, sender, reply) => {
  handle(request, sender).then(
    (data) => reply({ ok: true, data } satisfies Reply<unknown>),
    (error: unknown) =>
      reply({ ok: false, error: error instanceof Error ? error.message : String(error) }),
  );
  return true; // the reply is sent asynchronously
});

// A tab opened from one applying to a posting — an employer's form behind a link-out — is
// applying to the same posting.
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id === undefined || tab.openerTabId === undefined) return;
  const child = tab.id;
  void load(tab.openerTabId).then((opener) => {
    if (!opener.job || opener.submitted) return;
    return withTab(child, async (state) => {
      state.job ??= opener.job;
      state.active = true;
    });
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.storage.session.remove(slot(tabId));
});

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
});

chrome.runtime.onStartup.addListener(() => {
  void chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
});
