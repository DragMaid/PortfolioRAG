"use client";

import { useCallback, useEffect, useState } from "react";
import { describeError } from "@/lib/admin/client";
import { RagJobStatus, type RagJobDto } from "@/lib/api/generated";
import { jobFitApi } from "@/lib/api/generated/client";
import { isPending, pollDelayMs } from "./report";

export type JobFitState = "idle" | "submitting" | "running" | "done" | "error";

/**
 * Submitting a posting and waiting for the answer.
 *
 * Polling rather than a socket or a stream. The job takes tens of seconds and finishes
 * once: there is no partial result worth streaming, a socket would be a second transport to
 * operate for one message, and a poll survives the reader closing the laptop lid and coming
 * back — which, at forty seconds, some of them will.
 *
 * The poll is an effect keyed on an attempt counter rather than a function that schedules
 * itself. A self-scheduling callback closes over the state it was created with, so every
 * poll after the first would be reading a stale snapshot; incrementing a counter re-runs
 * the effect with fresh state and gives React a cleanup to cancel on unmount.
 */
export function useJobFit(handle: string) {
  const [state, setState] = useState<JobFitState>("idle");
  const [job, setJob] = useState<RagJobDto | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (state !== "running" || jobId === null) return;

    // `live` rather than only clearing the timer: the request may already be in flight when
    // the reader navigates away, and resolving it into a dead component is the classic way
    // a polling hook warns in the console.
    let live = true;

    const timer = setTimeout(async () => {
      try {
        const next = await jobFitApi.jobFitGetJob({ id: jobId });
        if (!live) return;

        setJob(next);

        if (isPending(next)) {
          setAttempt((value) => value + 1);
          return;
        }

        if (next.status === RagJobStatus.Succeeded && next.report) {
          setState("done");
          return;
        }

        // Failed, or cancelled because the owner removed their key while this was queued.
        // The API words both for a reader; the fallback covers the case where it did not.
        setState("error");
        setError(next.error ?? "The analysis could not be completed.");
      } catch (cause) {
        if (!live) return;
        setState("error");
        setError(await describeError(cause, "Lost contact with the API while waiting."));
      }
    }, pollDelayMs(attempt));

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [state, jobId, attempt]);

  // A second counter while it runs. Honest progress: the estimate the API returns is what
  // this kind of job usually takes, and showing the two together beats a bar that fills at
  // a rate nobody chose.
  useEffect(() => {
    if (state !== "running" && state !== "submitting") return;

    const tick = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(tick);
  }, [state]);

  const submit = useCallback(
    // The posting is the whole request: the role and company are read out of it, and come
    // back on the report.
    async (jobDescription: string) => {
      setState("submitting");
      setError(null);
      setJob(null);
      setJobId(null);
      setAttempt(0);
      setElapsed(0);

      try {
        const started = await jobFitApi.jobFitSubmit({
          handle,
          jobFitRequestDto: { jobDescription },
        });

        setJob(started);
        setJobId(started.id ?? null);
        setState("running");
      } catch (cause) {
        setState("error");
        setError(await describeError(cause, "The analysis could not be started."));
      }
    },
    [handle],
  );

  const reset = useCallback(() => {
    setState("idle");
    setJob(null);
    setJobId(null);
    setAttempt(0);
    setError(null);
    setElapsed(0);
  }, []);

  return {
    state,
    job,
    report: job?.report ?? null,
    error,
    elapsed,
    estimatedSeconds: job?.estimatedSeconds ?? 45,
    submit,
    reset,
    isBusy: state === "submitting" || state === "running",
  };
}
