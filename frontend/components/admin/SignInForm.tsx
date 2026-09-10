"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/admin/useAuth";
import { Button } from "./ui/Button";
import { Field, TextInput } from "./ui/Field";
import { Icon } from "./ui/Icon";
import { Panel } from "./ui/Panel";

/**
 * The gate. Email and password only: the API also links Google accounts, but that flow
 * needs a client id and a consent screen this build has no configuration for.
 */
// TODO(review): POST /api/auth/oauth/google exists and is not offered here.
export function SignInForm() {
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await signIn(email.trim(), password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Email" htmlFor="signin-email">
            <TextInput
              id="signin-email"
              type="email"
              value={email}
              required
              autoComplete="username"
              autoFocus
              onChange={(event) => setEmail(event.target.value)}
              className="text-sm"
            />
          </Field>

          <Field label="Password" htmlFor="signin-password">
            <TextInput
              id="signin-password"
              type="password"
              value={password}
              required
              autoComplete="current-password"
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
            Sign in
          </Button>
        </form>
      </Panel>
    </main>
  );
}
