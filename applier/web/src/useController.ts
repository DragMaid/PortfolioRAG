/**
 * The controller's state, kept in step by one event stream.
 *
 * The page never polls. `/api/events` opens with the whole table, the log so far and the
 * current status, and every change after that arrives as it happens — so a board thread that
 * is busy for a minute is visible as it goes rather than as a jump when it finishes.
 *
 * A dropped stream reconnects, and because each stream opens with the whole picture, a
 * reconnect heals whatever was missed while it was down.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Describe, Job, LogLine, Settings, SetupState, Status } from "./types";

const SCROLLBACK = 400;
const RECONNECT_MS = 2000;

interface Hello {
  kind: "hello";
  jobs: Job[];
  log: LogLine[];
  status: Status;
  settings: Settings;
  config: Describe;
  setup: SetupState;
}

type Incoming =
  | Hello
  | { kind: "job"; job: Job }
  | ({ kind: "log" } & LogLine)
  | { kind: "settings"; settings: Settings; config: Describe }
  | { kind: "review"; key: string }
  | { kind: "boards"; board: string; signedIn: boolean }
  | { kind: "sites"; site: string; signedIn: boolean }
  | ({ kind: "setup" } & SetupState)
  | ({ kind: "run" } & Status);

export interface Controller {
  jobs: Job[];
  byKey: Map<string, Job>;
  log: LogLine[];
  status: Status | null;
  settings: Settings | null;
  /** The config as the server last read it — the same applier.yaml the command line reads. */
  describe: Describe | null;
  setup: SetupState | null;
  signedIn: Record<string, boolean>;
  /** Whether the configured chat site's saved sign-in still works, once asked. */
  sites: Record<string, boolean>;
  connected: boolean;
  /** Whichever job is waiting on you to check its answers, if any. */
  reviewing: Job | null;
  setSettings: (next: Settings) => void;
}

export function useController(): Controller {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [log, setLog] = useState<LogLine[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [describe, setDescribe] = useState<Describe | null>(null);
  const [setup, setSetup] = useState<SetupState | null>(null);
  const [signedIn, setSignedIn] = useState<Record<string, boolean>>({});
  const [sites, setSites] = useState<Record<string, boolean>>({});
  const [connected, setConnected] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const apply = useCallback((event: Incoming) => {
    switch (event.kind) {
      case "hello":
        setJobs(event.jobs);
        setLog(event.log);
        setStatus(event.status);
        setSettings(event.settings);
        setDescribe(event.config);
        setSetup(event.setup);
        break;
      case "job": {
        const { job } = event;
        // The server sends whole rows and orders them itself, but between events the page
        // keeps its own order so a row does not jump under the pointer mid-click.
        setJobs((current) => {
          const index = current.findIndex((one) => one.key === job.key);
          if (index < 0) return [job, ...current];
          const next = current.slice();
          next[index] = job;
          return next;
        });
        break;
      }
      case "log":
        setLog((current) => [...current, { line: event.line, at: event.at }].slice(-SCROLLBACK));
        break;
      case "settings":
        setSettings(event.settings);
        setDescribe(event.config);
        setSetup(event.config.setup);
        break;
      case "setup": {
        const { kind: _setup, ...rest } = event;
        setSetup(rest as SetupState);
        break;
      }
      case "sites":
        setSites((current) => ({ ...current, [event.site]: event.signedIn }));
        break;
      case "boards":
        setSignedIn((current) => ({ ...current, [event.board]: event.signedIn }));
        break;
      case "run": {
        const { kind: _kind, ...rest } = event;
        setStatus(rest as Status);
        break;
      }
      default:
        break;
    }
  }, []);

  useEffect(() => {
    let source: EventSource | null = null;
    let stopped = false;

    const open = () => {
      if (stopped) return;
      source = new EventSource("/api/events");

      source.onopen = () => setConnected(true);
      source.onmessage = (message) => {
        try {
          apply(JSON.parse(message.data) as Incoming);
        } catch {
          /* a frame we cannot read is one frame, not a reason to tear the stream down */
        }
      };
      source.onerror = () => {
        setConnected(false);
        source?.close();
        // EventSource retries on its own, but not after the server closed the stream
        // deliberately — which it does when a subscription is dropped — so this does.
        timer.current = window.setTimeout(open, RECONNECT_MS);
      };
    };

    open();
    return () => {
      stopped = true;
      window.clearTimeout(timer.current);
      source?.close();
    };
  }, [apply]);

  const byKey = useMemo(() => new Map(jobs.map((job) => [job.key, job])), [jobs]);
  const reviewing = useMemo(() => jobs.find((job) => job.state === "reviewing") ?? null, [jobs]);

  return {
    jobs,
    byKey,
    log,
    status,
    settings,
    describe,
    setup,
    signedIn,
    sites,
    connected,
    reviewing,
    setSettings,
  };
}
