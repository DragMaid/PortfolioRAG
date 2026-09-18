"use client";

import { useCallback, useEffect, useState } from "react";
import { RagJobStatus, type RagJobDto } from "@/lib/api/generated";
import { isPending, pollDelayMs } from "@/lib/jobfit/report";
import { describeError, llmApi } from "./client";

export type CoverLetterInput = {
  jobDescription: string;
  notes: string;
};

/**
 * Writing a cover letter from the studio and waiting for it.
 *
 * Polled the same way as the public job-fit check (see `useJobFit`) and for the same
 * reasons; kept separate from `useIntelligence` so a letter being written does not lock the
 * rest of the tab.
 */
export function useCoverLetter(onFinished?: () => void) {
  const [job, setJob] = useState<RagJobDto | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const running = jobId !== null;

  useEffect(() => {
    if (jobId === null) return;

    let live = true;

    const timer = setTimeout(async () => {
      try {
        const next = await llmApi.llmGetJob({ id: jobId });
        if (!live) return;

        setJob(next);

        if (isPending(next)) {
          setAttempt((value) => value + 1);
          return;
        }

        setJobId(null);

        if (next.status !== RagJobStatus.Succeeded || !next.coverLetter) {
          setError(next.error ?? "The letter could not be written.");
        }

        // The month's spend moved; let the owner of the rest of the tab re-read it.
        onFinished?.();
      } catch (cause) {
        if (!live) return;
        setJobId(null);
        setError(await describeError(cause, "Lost contact with the API while waiting."));
      }
    }, pollDelayMs(attempt));

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [attempt, jobId, onFinished]);

  useEffect(() => {
    if (!running && !submitting) return;

    const tick = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(tick);
  }, [running, submitting]);

  const write = useCallback(async (input: CoverLetterInput) => {
    setSubmitting(true);
    setError(null);
    setJob(null);
    setAttempt(0);
    setElapsed(0);

    try {
      const started = await llmApi.llmWriteCoverLetter({
        coverLetterRequestDto: {
          jobDescription: input.jobDescription.trim(),
          notes: input.notes.trim() || undefined,
        },
      });

      setJob(started);
      setJobId(started.id ?? null);
    } catch (cause) {
      setError(await describeError(cause, "The letter could not be started."));
    } finally {
      setSubmitting(false);
    }
  }, []);

  const clear = useCallback(() => {
    setJob(null);
    setJobId(null);
    setError(null);
    setElapsed(0);
  }, []);

  return {
    write,
    clear,
    letter: job?.coverLetter ?? null,
    job,
    error,
    elapsed,
    estimatedSeconds: job?.estimatedSeconds ?? 30,
    isBusy: submitting || running,
  };
}
