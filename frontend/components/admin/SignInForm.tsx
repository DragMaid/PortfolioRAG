"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/admin/useAuth";
import { GOOGLE_CLIENT_ID, useGoogleSignIn } from "@/lib/admin/useGoogleSignIn";
import { Button } from "./ui/Button";
import { Field, TextInput } from "./ui/Field";
import { Icon } from "./ui/Icon";
import { Panel } from "./ui/Panel";

type Mode = "signin" | "signup";

/**
 * The gate: sign in to an existing account, or create one.
 *
 * Registration is open. Every account is its own tenant — its own posts, media, timeline
 * and profile, published at its own handle — so a new sign-up gets a portfolio of their
 * own rather than any access to somebody else's.
 */
export function SignInForm() {
  const { signIn, register, signInWithGoogle } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* Google's own button, rendered into this container by their script. It cannot be one of
     ours — the credential only ever arrives through their iframe. */
  const { containerRef, status: googleStatus } = useGoogleSignIn(async (idToken) => {
    setError(null);
    setBusy(true);

    try {
      await signInWithGoogle(idToken);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in with Google.");
    } finally {
      setBusy(false);
    }
  });

  const isSignUp = mode === "signup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (isSignUp) await register({ name, email, password });
      else await signIn(email.trim(), password);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : isSignUp
            ? "Could not create your account."
            : "Could not sign in.",
      );
    } finally {
      setBusy(false);
    }
  }

  function switchTo(next: Mode) {
    setMode(next);
    // The error belongs to the form that produced it: "that email is taken" makes no sense
    // still sitting above a sign-in form.
    setError(null);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <Panel className="w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-2">
          <span aria-hidden className="inline-block size-2.5 rounded-full bg-warm-black" />
          <h1 className="font-mono text-[13px] font-semibold tracking-tight text-warm-black">
            Admin <span className="font-normal text-warm-slate">/ Studio</span>
          </h1>
        </div>

        {/* Two tabs rather than a link that swaps the page: nothing here needs a route of
            its own, and the typed email survives the switch. */}
        <div
          role="tablist"
          aria-label="Sign in or create an account"
          className="mb-5 grid grid-cols-2 gap-1 rounded border border-warm-border bg-warm-sunken p-1"
        >
          {(["signin", "signup"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => switchTo(value)}
              className={
                mode === value
                  ? "rounded bg-warm-surface px-3 py-1.5 font-mono text-[11.5px] font-semibold text-warm-black shadow-sm"
                  : "rounded px-3 py-1.5 font-mono text-[11.5px] text-warm-slate transition-colors hover:text-warm-black"
              }
            >
              {value === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isSignUp ? (
            <Field
              label="Name"
              htmlFor="signup-name"
              hint="Shown on your portfolio, and where your handle comes from."
            >
              <TextInput
                id="signup-name"
                value={name}
                required
                autoComplete="name"
                autoFocus
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                className="text-sm"
              />
            </Field>
          ) : null}

          <Field label="Email" htmlFor="signin-email">
            <TextInput
              id="signin-email"
              type="email"
              value={email}
              required
              autoComplete="username"
              autoFocus={!isSignUp}
              maxLength={256}
              onChange={(event) => setEmail(event.target.value)}
              className="text-sm"
            />
          </Field>

          <Field
            label="Password"
            htmlFor="signin-password"
            hint={isSignUp ? "At least 12 characters." : undefined}
          >
            <TextInput
              id="signin-password"
              type="password"
              value={password}
              required
              // NOTE: no minLength when signing in. Enforcing the policy on the sign-in
              // form would tell a stranger the policy applies to a real account, which is
              // the same reason the API answers every credential failure identically.
              minLength={isSignUp ? 12 : undefined}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              onChange={(event) => setPassword(event.target.value)}
              className="text-sm"
            />
          </Field>

          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded border border-warm-danger/25 bg-warm-danger-bg px-3 py-2 font-mono text-[11.5px] leading-relaxed text-warm-danger"
            >
              <Icon name="error" className="mt-px text-[14px]" />
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="primary" busy={busy} className="justify-center py-2">
            {isSignUp ? "Create account" : "Sign in"}
          </Button>
        </form>

        {/* Only drawn when a client id is configured. A build without one shows password
            sign-in alone rather than a button that cannot work. */}
        {GOOGLE_CLIENT_ID ? (
          <div className="mt-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-warm-border" />
              <span className="font-mono text-[10.5px] tracking-wider text-warm-slate uppercase">
                or
              </span>
              <span className="h-px flex-1 bg-warm-border" />
            </div>

            {/* One button for both: the API creates the account on a Google subject it has
                not seen and signs in on one it has, so there is nothing to choose. */}
            <div ref={containerRef} className="flex min-h-[44px] justify-center" />

            {googleStatus === "error" ? (
              <p className="mt-2 text-center font-mono text-[10.5px] text-warm-slate">
                Google sign-in could not load. Use an email and password instead.
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="mt-5 border-t border-warm-border pt-4 font-mono text-[10.5px] leading-relaxed text-warm-slate">
          {isSignUp
            ? "Creating an account gives you your own portfolio, published at your own handle. It does not give you access to anyone else's."
            : "Signing in opens the studio for your own portfolio only."}
        </p>
      </Panel>
    </main>
  );
}
