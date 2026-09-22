/** What the server sends. Mirrors applier.controller.state and applier.server.app. */

export type Verdict = "weak" | "partial" | "promising" | "strong";

export type JobState =
  | "found"
  | "fetching"
  | "assessing"
  | "pending"
  | "queued"
  | "writing"
  | "applying"
  | "reviewing"
  | "awaiting_human"
  | "applied"
  | "skipped"
  | "unfit"
  | "excluded"
  | "external"
  | "unavailable"
  | "needs_input"
  | "unconfirmed"
  | "error";

/** Nothing further happens on its own. */
export const DONE: ReadonlySet<JobState> = new Set<JobState>([
  "applied",
  "skipped",
  "unfit",
  "excluded",
  "external",
  "unavailable",
  "needs_input",
  "unconfirmed",
  "error",
]);

/** Waiting on you, and on nothing else. */
export const WAITING: ReadonlySet<JobState> = new Set<JobState>([
  "pending",
  "reviewing",
  "awaiting_human",
]);

export interface Stage {
  name: string;
  at: number;
  detail: string | null;
  elapsed: number | null;
}

export interface ReviewQuestion {
  id: string;
  question: string;
  kind: string;
  required: boolean;
  options: string[];
  maxLength: number | null;
  answer: string | string[] | null;
  unanswered: boolean;
  discarded: string | null;
}

export interface Job {
  key: string;
  board: string;
  url: string;
  title: string;
  company: string | null;
  location: string | null;
  state: JobState;
  reason: string | null;
  verdict: Verdict | null;
  score: number | null;
  headline: string | null;
  missingEssentials: number;
  hasReport: boolean;
  hasLetter: boolean;
  questions: string[];
  review: ReviewQuestion[];
  tab: string | null;
  tabOpen: boolean;
  historic: boolean;
  foundAt: number;
  updatedAt: number;
  stages: Stage[];
}

export interface JobDetail extends Job {
  report: FitReport | null;
  letter: string | null;
  answers: Record<string, string | string[]>;
}

export interface Evidence {
  document_id: number;
  source_type: string;
  source_label: string;
  quote: string;
}

export interface Requirement {
  requirement: string;
  is_essential: boolean;
  status: "met" | "partial" | "missing";
  confidence: number;
  rationale: string;
  evidence: Evidence[];
}

export interface Usage {
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: string;
  duration_ms: number;
}

export interface FitReport {
  role_title: string;
  company: string | null;
  verdict: Verdict;
  score: number;
  headline: string;
  summary: string;
  requirements: Requirement[];
  strengths: string[];
  gaps: string[];
  retrieval: {
    queries: string[];
    passages_considered: number;
    passages_cited: number;
    citations_rejected: number;
  };
  usage: Usage;
}

export interface LetterReport {
  letter: string;
  role_title: string;
  company: string | null;
  sources: { source_type: string; source_label: string }[];
  usage: Usage;
}

/** When a run stops to ask about an employer's question. See RunConfig in config.py. */
export type Intervention = "never" | "missing" | "always";

export interface Settings {
  autoPick: boolean;
  autoSubmit: boolean;
  answers: Intervention;
  maxOpenHandoffs: number;
  searches: number[];
  maxApplications: number;
  maxAssessments: number;
  minVerdict: Verdict;
  minScore: number;
  allowMissingEssentials: number;
}

export interface Status {
  running: boolean;
  applied: number;
  assessed: number;
  waiting: number;
  openHandoffs: number;
  queued: number;
  handoffCapReached: boolean;
  stoppedBecause: string | null;
  boards: Record<string, { ready: boolean; pending: number }>;
}

export interface SearchConfig {
  index: number;
  board: string;
  keywords: string;
  location: string | null;
  url: string | null;
  maxPages: number;
  dateRange: number | null;
  enabled: boolean;
}

/** A search as the settings page edits it, before it has an index in the file. */
export interface SearchDraft {
  board: string;
  keywords: string;
  location?: string | null;
  url?: string | null;
  max_pages?: number;
  date_range?: number | null;
  enabled?: boolean;
}

/** One thing setup asks, from a real form or from the bundled baseline. */
export interface SetupQuestion {
  id: string;
  question: string;
  kind: string;
  options: string[];
  required: boolean;
  factKey: string;
  target: "name" | "email" | "phone" | "fact";
  hint: string | null;
  source: "posting" | "baseline";
}

export interface SetupState {
  done: boolean;
  probing: boolean;
  error: string | null;
  /** What still has to be true before a run could do anything. */
  missing: string[];
  found: {
    role: string;
    company: string | null;
    url: string;
    resumes: string[];
    questions: number;
  } | null;
  questions: SetupQuestion[];
}

export interface Providers {
  sites: { id: string; name: string }[];
  apis: string[];
  current: {
    provider: string;
    site: string;
    model: string | null;
    browser: string;
    headless: boolean;
    /** null for `web`, which has no key. */
    keyVariable: string | null;
    /** Whether that variable has something in it. The key itself never reaches this page. */
    keyIsSet: boolean;
  };
}

export interface Describe {
  configPath: string;
  stateDir: string;
  portfolioApi: string;
  model: { provider: string; site: string };
  candidate: { name: string; email?: string | null; phone?: string | null; facts: Record<string, string>; resume: string };
  boards: string[];
  searches: SearchConfig[];
  policy: {
    minVerdict: Verdict;
    minScore: number;
    allowMissingEssentials: number;
    maxApplications: number;
    maxAssessments: number;
  };
  settings: Settings;
  setup: SetupState;
  /** What still has to be true before a run could do anything. */
  ready: string[];
  notes: { letter: string; answers: string };
  portfolio: {
    api: string;
    tokenSet: boolean;
    /** Where the token in use came from, so one that is not taking effect can be explained. */
    tokenSource: "page" | "environment" | null;
    tokenVariable: string;
    storedAt: string;
  };
  resume: { select: string | null; upload: string | null };
}

export interface LogLine {
  line: string;
  at: number;
}

export interface HistoryEntry {
  key: string;
  board: string;
  status: string;
  title: string;
  company: string | null;
  url: string;
  reason: string | null;
  verdict: Verdict | null;
  score: number | null;
  questions: string[];
  hasReport: boolean;
  hasLetter: boolean;
  updatedAt: string;
  appliedAt: string | null;
}

export interface QuestionDigest {
  question: string;
  times: number;
  postings: { key: string; title: string; company: string }[];
}

/** A run of one of rag's local pipelines, from /api/rag. */
export interface RagRun {
  id: string;
  kind: "job-fit" | "cover-letter";
  status: "running" | "succeeded" | "failed";
  stage: string;
  stages: string[];
  outputs: Record<string, unknown>;
  elapsed: number;
  report: FitReport | LetterReport | null;
  error: string | null;
}
