"use client";

import { useEffect, useState } from "react";
import type { RevealedSecret } from "@/lib/admin/useApiTokens";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";

/**
 * The one and only sight of a freshly minted secret.
 *
 * The API keeps a hash, so this value exists nowhere else and cannot be fetched again —
 * which is why dismissing it is a deliberate click rather than anything that happens on a
 * blur, a tab change or the next render.
 */
export function SecretReveal({
  revealed,
  onDismiss,
}: {
  revealed: RevealedSecret;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(revealed.secret);
      setCopied(true);
    } catch {
      // Clipboard access can be refused outright (an insecure origin, a hardened browser).
      // The secret is on screen and selectable, so there is nothing to recover from.
      setCopied(false);
    }
  }

  return (
    <div
      role="region"
      aria-label="Your new API token"
      className="flex flex-col gap-3 rounded border border-warm-accent/40 bg-warm-accent/10 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Icon name="verified" className="mt-0.5 text-[18px] text-warm-accent" />
          <div>
            <h3 className="font-mono text-xs font-semibold tracking-wider text-warm-black uppercase">
              {revealed.reason === "created" ? "Token issued" : "Token rotated"}
            </h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-warm-slate">
              Copy <span className="font-medium text-warm-black">{revealed.token.name}</span> now.
              This is the only time it can be shown — the server keeps only a hash of it, so if
              you lose it the way back is to rotate the token again.
              {revealed.reason === "rotated"
                ? " Anything still using the previous secret has already stopped working."
                : null}
            </p>
          </div>
        </div>

        {/*
          * Focused on mount, so a keyboard reader lands on what just happened rather than
          * on wherever the issue form left them. The panel is remounted per secret by its
          * key, which is what makes "on mount" fire again for a rotation.
          */}
        <Button
          autoFocus
          variant="ghost"
          icon="x"
          onClick={onDismiss}
          aria-label="Dismiss this token"
        >
          Done
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/*
         * Readonly rather than a <code> block: an input can be selected, tabbed to and read
         * out by a screen reader as a value, and a password manager can pick it up.
         */}
        <input
          readOnly
          value={revealed.secret}
          aria-label="The token secret"
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 rounded border border-warm-border bg-warm-surface px-3 py-2 font-mono text-[12px] text-warm-black focus:border-warm-black focus:outline-none"
        />

        <Button
          variant="primary"
          icon={copied ? "check-circle" : "copy"}
          onClick={() => void copy()}
          className="shrink-0"
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      <p className="font-mono text-[10.5px] leading-relaxed text-warm-slate">
        Send it as{" "}
        <span className="text-warm-black">Authorization: Bearer {revealed.token.prefix}…</span>
      </p>
    </div>
  );
}
