"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiTokenScope,
  type ApiTokenDto,
  type ApiTokenSecretDto,
} from "@/lib/api/generated";
import { authAccountApi, describeError } from "./client";
import { useAuth } from "./useAuth";
import { useToast } from "./useToast";

/** What the issue form collects. Expiry is in days; null issues one that never lapses. */
export type TokenDraft = {
  name: string;
  scope: ApiTokenScope;
  expiresInDays: number | null;
};

/**
 * A secret the server has just handed back, held until the reader dismisses it.
 *
 * This is the only copy that will ever exist — the API stores a hash — so it is kept in
 * component state rather than written anywhere, and the panel is built so that dismissing
 * it is a deliberate act.
 */
export type RevealedSecret = {
  secret: string;
  token: ApiTokenDto;
  /** Rotating an existing token reads differently from issuing a new one. */
  reason: "created" | "rotated";
};

/**
 * The access tab's state: the tokens on the account, and whichever secret was last minted.
 *
 * Every row writes straight through, like the profile tab's lists — each token is its own
 * resource and there is nothing to hold back behind a Save.
 */
export function useApiTokens() {
  const { session } = useAuth();
  const { showToast } = useToast();

  const authorId = session?.authorId ?? null;

  const [tokens, setTokens] = useState<ApiTokenDto[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState<null | "issuing" | "row">(null);
  const [revealed, setRevealed] = useState<RevealedSecret | null>(null);

  // Drops the answer to a load that a later one has already overtaken.
  const requestToken = useRef(0);

  const fail = useCallback(
    async (error: unknown, fallback: string) => {
      showToast(await describeError(error, fallback), "error");
    },
    [showToast],
  );

  const load = useCallback(async () => {
    if (authorId === null) return;

    const marker = ++requestToken.current;

    try {
      const loaded = await authAccountApi.authListApiTokens();
      if (marker !== requestToken.current) return;

      setTokens(loaded);
      setState("ready");
    } catch (error) {
      if (marker !== requestToken.current) return;
      setState("error");
      await fail(error, "Could not load your API tokens.");
    }
  }, [authorId, fail]);

  useEffect(() => {
    // Wrapped rather than called straight: an effect body may not update state
    // synchronously, and the first thing load does on failure is exactly that.
    void (async () => {
      await load();
    })();
  }, [load]);

  const reload = useCallback(async () => {
    setState("loading");
    await load();
  }, [load]);

  const create = useCallback(
    async (draft: TokenDraft): Promise<boolean> => {
      const name = draft.name.trim();
      if (!name) return false;

      setBusy("issuing");

      try {
        const result: ApiTokenSecretDto = await authAccountApi.authCreateApiToken({
          createApiTokenDto: {
            name,
            scope: draft.scope,
            expiresInDays: draft.expiresInDays ?? undefined,
          },
        });

        setRevealed({ secret: result.secret!, token: result.token!, reason: "created" });
        await load();
        showToast(`Issued “${name}”`);
        return true;
      } catch (error) {
        await fail(error, "Could not issue that token.");
        return false;
      } finally {
        setBusy(null);
      }
    },
    [fail, load, showToast],
  );

  const rotate = useCallback(
    async (id: number, name: string) => {
      setBusy("row");

      try {
        const result = await authAccountApi.authRotateApiToken({ id });

        setRevealed({ secret: result.secret!, token: result.token!, reason: "rotated" });
        await load();
        showToast(`Rotated “${name}” — the old secret no longer works`, "info");
      } catch (error) {
        await fail(error, "Could not rotate that token.");
      } finally {
        setBusy(null);
      }
    },
    [fail, load, showToast],
  );

  const revoke = useCallback(
    async (id: number, name: string) => {
      setBusy("row");

      try {
        await authAccountApi.authRevokeApiToken({ id });
        await load();
        showToast(`Revoked “${name}”`, "info");
      } catch (error) {
        await fail(error, "Could not revoke that token.");
      } finally {
        setBusy(null);
      }
    },
    [fail, load, showToast],
  );

  /** Drops a dead token's row. The API refuses this while the token still works. */
  const forget = useCallback(
    async (id: number, name: string) => {
      setBusy("row");

      try {
        await authAccountApi.authDeleteApiToken({ id });
        await load();
        showToast(`Removed “${name}” from the list`, "info");
      } catch (error) {
        await fail(error, "Could not remove that token.");
      } finally {
        setBusy(null);
      }
    },
    [fail, load, showToast],
  );

  const dismissSecret = useCallback(() => setRevealed(null), []);

  const activeCount = useMemo(
    () => tokens.filter((token) => token.isActive).length,
    [tokens],
  );

  return {
    tokens,
    activeCount,
    state,
    busy,
    revealed,
    create,
    rotate,
    revoke,
    forget,
    dismissSecret,
    reload,
  };
}

/**
 * How a token reads on its row. Revoked and expired are both "dead", but they died
 * differently and only one of them was somebody's decision.
 */
export type TokenStatus = "active" | "expired" | "revoked";

export function tokenStatus(token: ApiTokenDto): TokenStatus {
  if (token.revokedAt) return "revoked";
  return token.isActive ? "active" : "expired";
}

/** "3 minutes ago", "in 88 days" — coarse on purpose, since none of these are to the second. */
export function formatRelative(value: Date | null | undefined): string | null {
  if (!value) return null;

  const deltaMs = value.getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 24 * 60 * 60 * 1000],
    ["month", 30 * 24 * 60 * 60 * 1000],
    ["day", 24 * 60 * 60 * 1000],
    ["hour", 60 * 60 * 1000],
    ["minute", 60 * 1000],
  ];

  for (const [unit, ms] of units) {
    if (Math.abs(deltaMs) >= ms) return formatter.format(Math.round(deltaMs / ms), unit);
  }

  return "just now";
}
