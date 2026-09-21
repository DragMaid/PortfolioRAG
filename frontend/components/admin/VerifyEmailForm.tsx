"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/admin/useAuth";
import { Button } from "./ui/Button";
import { Field, TextInput } from "./ui/Field";
import { Icon } from "./ui/Icon";

const CODE_LENGTH = 6;

/**
 * The code step: six digits, and a way to ask for them again.
 *
 * Only accounts that signed up with a password ever see it. Google has already vouched
 * for the addresses it hands over, so those accounts go straight into the studio — which
 * is also why the resend button here is not a way to make the API mail anybody on demand:
 * it only ever writes to the address the session already belongs to.
 */
export function VerifyEmailForm({
  email,
  onConfirmed,
  className,
}: {
  email: string;
  onConfirmed?: () => void;
  className?: string;
}) {
  const { verifyEmail, resendVerification } = useAuth();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "verifying" | "resending">(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy("verifying");

    try {
      await verifyEmail(code);
      onConfirmed?.();
    } catch (caught) {
      // The digits were wrong or stale either way, and leaving them in the box invites a
      // second submit of the same thing against an attempt counter that does not forgive.
      setCode("");
      inputRef.current?.focus();
      setError(caught instanceof Error ? caught.message : "Could not confirm that code.");
    } finally {
      setBusy(null);
    }
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    setBusy("resending");

    try {
      const challenge = await resendVerification();

      setNotice(
        challenge.delivered === false
          ? "This API has no mail relay configured, so the code was written to its log instead."
          : `A new code is on its way to ${challenge.email ?? email}. The one before it no longer works.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send another code.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="flex flex-col gap-4">
        <Field
          label="Verification code"
          htmlFor="verify-code"
          hint={`The ${CODE_LENGTH} digits we sent to ${email}. It expires shortly, and only the newest one works.`}
        >
          <TextInput
            id="verify-code"
            ref={inputRef}
            value={code}
            required
            // NOTE: inputMode rather than type="number" — a number input on a phone brings
            // up the right keypad but also brings spinners, scroll-to-change and a value
            // that drops the leading zero a code is just as likely to start with.
            inputMode="numeric"
            pattern={`\\d{${CODE_LENGTH}}`}
            maxLength={CODE_LENGTH}
            autoComplete="one-time-code"
            placeholder="000000"
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            className="text-center font-mono text-lg tracking-[0.4em]"
          />
        </Field>

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded border border-warm-danger/25 bg-warm-danger-bg px-3 py-2 text-[13px] leading-relaxed text-warm-danger"
          >
            <Icon name="error" className="mt-px text-[14px]" />
            {error}
          </p>
        ) : null}

        {notice ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded border border-warm-border bg-warm-sunken px-3 py-2 text-[13px] leading-relaxed text-warm-slate"
          >
            <Icon name="check-circle" className="mt-px text-[14px]" />
            {notice}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            variant="primary"
            busy={busy === "verifying"}
            disabled={code.length !== CODE_LENGTH}
            className="justify-center py-2"
          >
            Confirm address
          </Button>

          <Button
            type="button"
            icon="schedule"
            busy={busy === "resending"}
            onClick={() => void handleResend()}
          >
            Send another
          </Button>
        </div>
      </div>
    </form>
  );
}
