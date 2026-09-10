"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { authApi, describeError } from "./client";
import {
  clearSession,
  getServerSessionSnapshot,
  getSessionSnapshot,
  readSession,
  SESSION_PENDING,
  subscribeToSession,
  writeSession,
  type Session,
} from "./session";

type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthValue = {
  status: AuthStatus;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

// Create the context so useContext can be invoked to share this across without
// having to pass the variable into props
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // This read the value from an external data store
  const snapshot = useSyncExternalStore(
    subscribeToSession,
    getSessionSnapshot,
    // NOTE: A function that returns the initial snapshot of the data in the store.
    // It will be used only during server rendering
    getServerSessionSnapshot,
  );

  const session = snapshot === SESSION_PENDING ? null : snapshot;
  const status: AuthStatus =
    snapshot === SESSION_PENDING ? "loading" : snapshot ? "authenticated" : "anonymous";

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const result = await authApi.authLogin({ loginDto: { email, password } });
      const next = writeSession(result);

      if (!next) throw new Error("The server did not return a usable session.");
    } catch (error) {
      throw new Error(await describeError(error, "Could not sign in."));
    }
  }, []);

  // useCallback with no deps make sure that between re-renders, the func ref is always the same
  const signOut = useCallback(async () => {
    const current = readSession();
    clearSession();

    if (current?.refreshToken) {
      try {
        await authApi.authLogout({ refreshTokenDto: { refreshToken: current.refreshToken } });
      } catch { }
    }
  }, []);

  // useMemo is used to cache a calc between re-renders
  const value = useMemo<AuthValue>(
    () => ({ status, session, signIn, signOut }),
    [status, session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside an AuthProvider.");
  return value;
}
