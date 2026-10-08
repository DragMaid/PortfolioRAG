/**
 * The server, as functions.
 *
 * Everything that changes something answers with the row or the status as it stands at that
 * moment, which is not necessarily the end of the story: a press that queues work on a board
 * comes back at once, and what came of it arrives over the event stream. So callers use these
 * for the error, and the stream for the truth.
 */

import type {
  Describe,
  HistoryEntry,
  Job,
  JobDetail,
  Providers,
  QuestionDigest,
  RagRun,
  SearchDraft,
  Settings,
  SetupState,
  Status,
} from "./types";

export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
    });
  } catch (cause) {
    throw new ApiError(`Could not reach the controller. Is \`applier serve\` still running? (${cause})`);
  }

  if (!response.ok) {
    let detail = `The server answered ${response.status}.`;
    try {
      const body = await response.json();
      detail = body?.detail ?? detail;
    } catch {
      /* a body that is not JSON tells us nothing more than the status did */
    }
    throw new ApiError(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

const post = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

/** Job keys are `board:id`; the colon is legal in a path but encoding it is unambiguous. */
const at = (key: string) => `/api/jobs/${encodeURIComponent(key)}`;

export const api = {
  describe: () => request<Describe>("/api/config"),
  status: () => request<Status>("/api/status"),
  jobs: () => request<{ jobs: Job[]; status: Status }>("/api/jobs"),
  job: (key: string) => request<JobDetail>(at(key)),

  settings: (patch: Partial<Settings>) =>
    request<Settings>("/api/settings", { method: "PATCH", body: JSON.stringify(patch) }),

  start: () => post<Status>("/api/run"),
  stop: () => request<Status>("/api/run", { method: "DELETE" }),

  approve: (key: string) => post<Job>(`${at(key)}/approve`),
  skip: (key: string) => post<Job>(`${at(key)}/skip`),
  submitted: (key: string) => post<Job>(`${at(key)}/submitted`),
  takeBack: (key: string) => request<Job>(`${at(key)}/submitted`, { method: "DELETE" }),
  retry: (key: string) => post<Job>(`${at(key)}/retry`),

  review: (key: string, decision: ReviewDecision) => post<{ ok: boolean }>(`${at(key)}/review`, decision),

  addFacts: (facts: Record<string, string>) =>
    post<{ facts: Record<string, string> }>("/api/facts", facts),

  /** Setting up: one mock application, and the questions it turns into a profile. */
  setup: {
    state: () => request<SetupState>("/api/setup"),
    /** Runs the mock application. Answered on the event stream, not here. */
    probe: (url: string, board?: string) => post<SetupState>("/api/setup/probe", { url, board }),
    /** Roles the portfolio argues for. Needs the API, the worker and a model; slow. */
    suggest: () =>
      post<{ searches: { board: string; keywords: string; why: string; evidence: string }[] }>(
        "/api/setup/suggest",
      ),
    preview: (search: SearchDraft) =>
      post<{ listings: { key: string; url: string; title: string; company: string | null }[] }>(
        "/api/setup/preview",
        search,
      ),
    save: (payload: {
      answers: Record<string, string>;
      resume?: { select?: string | null; upload?: string | null };
      letterNotes?: string;
      answerNotes?: string;
      searches?: SearchDraft[];
    }) => post<Describe>("/api/setup/save", payload),
    skip: () => post<Describe>("/api/setup/skip"),
  },

  /** The config file, structurally and as text. Both write the same applier.yaml. */
  config: {
    raw: () => request<{ path: string; text: string }>("/api/config/raw"),
    writeRaw: (text: string) =>
      request<{ path: string; text: string }>("/api/config/raw", {
        method: "PUT",
        body: JSON.stringify({ text }),
      }),
    profile: (patch: Record<string, unknown>) =>
      request<Describe>("/api/profile", { method: "PATCH", body: JSON.stringify(patch) }),
    /** The file itself as the body: the controller keeps its own copy. */
    uploadResume: (file: File) =>
      request<Describe>(`/api/profile/resume?name=${encodeURIComponent(file.name)}`, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/octet-stream" },
      }),
    forgetResume: () => request<Describe>("/api/profile/resume", { method: "DELETE" }),
  },

  /** The portfolio token. It goes in and is never read back. */
  portfolio: {
    set: (token: string) =>
      request<{ tokenSet: boolean }>("/api/portfolio/token", {
        method: "PUT",
        body: JSON.stringify({ token }),
      }),
    forget: () => request<{ tokenSet: boolean }>("/api/portfolio/token", { method: "DELETE" }),
  },

  providers: () => request<Providers>("/api/providers"),
  /** Asks whether the configured chat site's saved sign-in still works. */
  sites: () => request<{ site: string | null }>("/api/sites"),
  signInSite: (site: string) => post<{ site: string }>(`/api/sites/${site}/login`),

  signIn: (board: string) => post<{ board: string }>(`/api/boards/${board}/login`),

  /** The key the browser extension is paired with. Shown here to paste into its side panel. */
  extension: {
    key: () => request<{ key: string; version: number }>("/api/extension"),
    rotate: () => post<{ key: string; version: number }>("/api/extension/key"),
  },

  /** Asks each board whether it is still signed in. Answered on the event stream. */
  boards: () => request<{ boards: string[] }>("/api/boards"),

  history: (status?: string) =>
    request<{ counts: Record<string, number>; entries: HistoryEntry[] }>(
      `/api/history${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),

  questions: () => request<{ questions: QuestionDigest[]; facts: Record<string, string> }>("/api/questions"),

  /** rag's own local pipelines, mounted under /api/rag. The token is the server's. */
  rag: {
    start: (kind: "job-fit" | "cover-letter", jobDescription: string, notes?: string) =>
      post<RagRun>("/api/rag/api/runs", { kind, jobDescription, notes }),
    run: (id: string) => request<RagRun>(`/api/rag/api/runs/${id}`),
  },
};

export type ReviewDecision =
  | { action: "approve"; answers: Record<string, string | string[] | null> }
  | { action: "retry"; facts: Record<string, string> }
  | { action: "discard" };
