"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RagJobKind,
  RagJobStatus,
  RagSourceStatus,
  type LlmCredentialDto,
  type LlmProvider,
  type LlmProviderDto,
  type RagJobDto,
} from "@/lib/api/generated";
import { isPending, pollDelayMs } from "@/lib/jobfit/report";
import { describeError, llmApi } from "./client";
import { useAuth } from "./useAuth";
import { useToast } from "./useToast";

/** The exposure dials, edited as a draft because they are one form with one Save. */
export type ExposureDraft = {
  isPublicFitEnabled: boolean;
  dailyVisitorLimit: number;
  monthlyAccountLimit: number;
  monthlyBudgetUsd: number;
  model: string;
};

export type Busy = null | "saving" | "validating" | "deleting" | "trying";

/** How often the index table is re-read while anything in it is still waiting to settle. */
const INDEX_POLL_MS = 3000;

/**
 * The intelligence tab: the provider key, what it may cost, the index, and a trial run.
 *
 * Unlike the access tab's token list, the key itself is not a list of resources — there is
 * one, it is replaced rather than edited, and the dials around it are a form. So the key
 * writes straight through on submit and the dials are held as a draft with a Save, which
 * is the same split the profile tab makes for the same reason.
 */
export function useIntelligence() {
  const { session } = useAuth();
  const { showToast } = useToast();

  const authorId = session?.authorId ?? null;

  const [credential, setCredential] = useState<LlmCredentialDto | null>(null);
  // What this deployment can accept a key for, as the API lists it — the picker offers
  // exactly these rather than assuming a vendor.
  const [providers, setProviders] = useState<LlmProviderDto[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState<Busy>(null);
  const [draft, setDraft] = useState<ExposureDraft | null>(null);

  // The studio's own trial run, and whatever rebuild is in flight. Both are jobs on the
  // same queue, polled the same way.
  const [trial, setTrial] = useState<RagJobDto | null>(null);
  const [trialError, setTrialError] = useState<string | null>(null);
  const [watching, setWatching] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const requestToken = useRef(0);

  const fail = useCallback(
    async (error: unknown, fallback: string) => {
      showToast(await describeError(error, fallback), "error");
    },
    [showToast],
  );

  const adopt = useCallback((next: LlmCredentialDto | null) => {
    setCredential(next);
    setDraft(next ? toDraft(next) : null);
  }, []);

  const load = useCallback(async () => {
    if (authorId === null) return;

    const marker = ++requestToken.current;

    try {
      // 204 when no key has been added, which the generated client surfaces as null or
      // undefined. That is the normal state of a new account, not an error.
      const [loaded, supported] = await Promise.all([
        llmApi.llmGetCredential(),
        llmApi.llmGetProviders(),
      ]);
      if (marker !== requestToken.current) return;

      setProviders(supported);
      adopt(loaded ?? null);
      setState("ready");
    } catch (error) {
      if (marker !== requestToken.current) return;
      setState("error");
      await fail(error, "Could not load your provider key.");
    }
  }, [adopt, authorId, fail]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  /* ---------------------------------------------------------------------- */
  /* The key                                                                */
  /* ---------------------------------------------------------------------- */

  const saveKey = useCallback(
    async (provider: LlmProvider, apiKey: string, model?: string): Promise<boolean> => {
      const trimmed = apiKey.trim();
      if (!trimmed) return false;

      setBusy("saving");

      try {
        const saved = await llmApi.llmSaveCredential({
          saveLlmCredentialDto: {
            provider,
            apiKey: trimmed,
            model: model?.trim() || undefined,
          },
        });

        adopt(saved);
        showToast("Key checked with the provider and stored");
        return true;
      } catch (error) {
        await fail(error, "That key could not be saved.");
        return false;
      } finally {
        setBusy(null);
      }
    },
    [adopt, fail, showToast],
  );

  const revalidate = useCallback(async () => {
    setBusy("validating");

    try {
      const checked = await llmApi.llmRevalidate();
      adopt(checked);

      showToast(
        checked.isUsable ? "The key still works" : "The provider refused that key",
        checked.isUsable ? "success" : "error",
      );
    } catch (error) {
      await fail(error, "The key could not be checked.");
    } finally {
      setBusy(null);
    }
  }, [adopt, fail, showToast]);

  const remove = useCallback(async () => {
    setBusy("deleting");

    try {
      await llmApi.llmDeleteCredential();
      adopt(null);
      setTrial(null);
      showToast("Key removed, along with the index it built", "info");
    } catch (error) {
      await fail(error, "The key could not be removed.");
    } finally {
      setBusy(null);
    }
  }, [adopt, fail, showToast]);

  /* ---------------------------------------------------------------------- */
  /* The dials                                                              */
  /* ---------------------------------------------------------------------- */

  const update = useCallback(
    <K extends keyof ExposureDraft>(key: K, value: ExposureDraft[K]) =>
      setDraft((current) => (current ? { ...current, [key]: value } : current)),
    [],
  );

  const saveExposure = useCallback(async () => {
    if (!draft) return;

    setBusy("saving");

    try {
      const saved = await llmApi.llmUpdateSettings({
        updateLlmSettingsDto: {
          isPublicFitEnabled: draft.isPublicFitEnabled,
          dailyVisitorLimit: draft.dailyVisitorLimit,
          monthlyAccountLimit: draft.monthlyAccountLimit,
          monthlyBudgetUsd: draft.monthlyBudgetUsd,
          model: draft.model || undefined,
        },
      });

      adopt(saved);
      showToast(saved.isPublicFitEnabled ? "Visitors can now check job fit" : "Settings saved");
    } catch (error) {
      await fail(error, "Those settings could not be saved.");
    } finally {
      setBusy(null);
    }
  }, [adopt, draft, fail, showToast]);

  const isDirty = useMemo(
    () => Boolean(credential && draft && !sameDraft(draft, toDraft(credential))),
    [credential, draft],
  );

  /* ---------------------------------------------------------------------- */
  /* Jobs                                                                   */
  /* ---------------------------------------------------------------------- */

  const tryJobFit = useCallback(
    async (jobDescription: string) => {
      setBusy("trying");
      setTrial(null);
      setTrialError(null);

      try {
        const job = await llmApi.llmTryJobFit({ jobFitRequestDto: { jobDescription } });

        setTrial(job);
        setWatching(job.id ?? null);
        setAttempt(0);
      } catch (error) {
        setTrialError(await describeError(error, "The analysis could not be started."));
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  // The server keeps the index current on its own; this only re-reads the table while some
  // source is still queued or indexing, so the statuses move without a refresh.
  const indexPending = useMemo(
    () =>
      (credential?.index?.sources ?? []).some(
        (source) =>
          source.status === RagSourceStatus.Queued || source.status === RagSourceStatus.Indexing,
      ),
    [credential],
  );

  /**
   * Re-reads the credential without touching the exposure draft. For background refreshes:
   * the form may hold unsaved edits, and a re-read must not throw them away.
   */
  const refresh = useCallback(async () => {
    try {
      const next = await llmApi.llmGetCredential();
      if (next) setCredential(next);
    } catch {
      // A missed refresh is retried on the next tick; the screen just lags a moment.
    }
  }, []);

  useEffect(() => {
    if (!indexPending || busy !== null) return;

    const timer = setTimeout(() => void refresh(), INDEX_POLL_MS);
    return () => clearTimeout(timer);
    // `credential` so each refresh schedules the next: the pending flag alone stays true
    // across refreshes and would not re-run this.
  }, [busy, credential, indexPending, refresh]);

  // Polls the trial analysis while it runs.
  useEffect(() => {
    if (watching === null) return;

    let live = true;

    const timer = setTimeout(async () => {
      try {
        const job = await llmApi.llmGetJob({ id: watching });
        if (!live) return;

        if (job.kind === RagJobKind.JobFit) setTrial(job);

        if (isPending(job)) {
          setAttempt((value) => value + 1);
          return;
        }

        setWatching(null);

        if (job.status === RagJobStatus.Failed) {
          setTrialError(job.error ?? "The job failed.");
        }

        // The index count and the month's spend both moved, so the panel is re-read rather
        // than patched from the job — the server is the one that knows both.
        await load();
      } catch (error) {
        if (!live) return;
        setWatching(null);
        await fail(error, "Lost contact with the API while waiting.");
      }
    }, pollDelayMs(attempt));

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [attempt, fail, load, watching]);

  const clearTrial = useCallback(() => {
    setTrial(null);
    setTrialError(null);
  }, []);

  return {
    state,
    busy,
    credential,
    providers,
    draft,
    isDirty,
    update,
    saveExposure,
    saveKey,
    revalidate,
    remove,
    tryJobFit,
    trial,
    trialError,
    clearTrial,
    isWorking: watching !== null,
    indexPending,
    reload: load,
    refresh,
  };
}

function toDraft(credential: LlmCredentialDto): ExposureDraft {
  return {
    isPublicFitEnabled: credential.isPublicFitEnabled ?? false,
    dailyVisitorLimit: credential.dailyVisitorLimit ?? 20,
    monthlyAccountLimit: credential.monthlyAccountLimit ?? 500,
    monthlyBudgetUsd: credential.monthlyBudgetUsd ?? 10,
    model: credential.model ?? "",
  };
}

function sameDraft(left: ExposureDraft, right: ExposureDraft): boolean {
  return (
    left.isPublicFitEnabled === right.isPublicFitEnabled &&
    left.dailyVisitorLimit === right.dailyVisitorLimit &&
    left.monthlyAccountLimit === right.monthlyAccountLimit &&
    left.monthlyBudgetUsd === right.monthlyBudgetUsd &&
    left.model === right.model
  );
}
