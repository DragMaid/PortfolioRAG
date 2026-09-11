"use client";

import type { AuthResultDto } from "@/lib/api/generated";
import { API_BASE_URL } from "@/lib/api/generated/client";

// TODO: put this in HttpOnly cookie 
const STORAGE_KEY = "portfolio.admin.session";

const REFRESH_SKEW_MS = 30_000;

export type Session = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  authorId: number;
  authorName: string;
  authorEmail: string;
  /** Where this account's portfolio is published: `/{handle}`. */
  authorHandle: string;
};

// NOTE: the Symnol operation always return a unique identifier no matter what string is passed in
export const SESSION_PENDING = Symbol("session.pending");

// NOTE: the session pending is added because we are doing server side rendering (SSR) so
// the window element won't be available to extract the token, while null indicate logged out.
export type SessionSnapshot = Session | null | typeof SESSION_PENDING;

type Listener = () => void;

const listeners = new Set<Listener>();

// undefined means not loaded while null mean returned with null
let snapshot: Session | null | undefined;

// In-flight refresh, shared so ten parallel requests spend one refresh token rather than ten.
let refreshInFlight: Promise<Session | null> | null = null;

export function readSession(): Session | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.accessToken || !parsed?.refreshToken) return null;

    return parsed;
  } catch {
    // Unreadable storage (private mode, a half-written value) is the same as signed out.
    return null;
  }
}

export function writeSession(result: AuthResultDto): Session | null {
  if (!result.accessToken || !result.refreshToken || !result.author?.id) return null;

  const session: Session = {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresAt: Date.now() + (result.expiresIn ?? 900) * 1000,
    authorId: result.author.id,
    authorName: result.author.name ?? "",
    authorEmail: result.author.email ?? "",
    authorHandle: result.author.handle ?? "",
  };

  persist(session);
  return session;
}

export function clearSession(): void {
  persist(null);
}

export function subscribeToSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Get the snap shot, read session if not already defined
export function getSessionSnapshot(): SessionSnapshot {
  if (snapshot === undefined) snapshot = readSession();
  return snapshot;
}

export function getServerSessionSnapshot(): SessionSnapshot {
  return SESSION_PENDING;
}

// Return saved session and maybe refreshed it
export async function getAccessToken(): Promise<string | null> {
  const session = readSession();
  if (!session) return null;

  // Try to refresh before-hand rather than waiting till the end
  if (Date.now() < session.expiresAt - REFRESH_SKEW_MS) return session.accessToken;

  const refreshed = await refresh(session.refreshToken);
  return refreshed?.accessToken ?? null;
}

// Spends a refresh token for a new pair.
async function refresh(refreshToken: string): Promise<Session | null> {
  // NOTE: the refreshInFlight acts as a lock, if one function is already requesting for
  // token refresh, the consequent functions will have to wait for that to complete (next calls do nothing)
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      // Clear session if unable to refresh
      if (!response.ok) {
        clearSession();
        return null;
      }

      return writeSession((await response.json()) as AuthResultDto);
    } catch {
      // A network failure is not a revoked session: keep the tokens and let the caller fail.
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

// This function update the snapshot state (Session if logged in and null if logged out)
function persist(session: Session | null): void {
  snapshot = session;

  if (typeof window !== "undefined") {
    try {
      if (session) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch { }
  }

  for (const listener of listeners) listener();
}
