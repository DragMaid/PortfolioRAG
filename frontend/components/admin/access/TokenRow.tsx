"use client";

import { useState } from "react";
import type { ApiTokenDto } from "@/lib/api/generated";
import { formatDate } from "@/lib/admin/format";
import { formatRelative, tokenStatus } from "@/lib/admin/useApiTokens";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { StatusDot } from "../ui/StatusDot";

type TokenRowProps = {
  token: ApiTokenDto;
  busy: boolean;
  onRotate: (id: number, name: string) => Promise<void>;
  onRevoke: (id: number, name: string) => Promise<void>;
  onForget: (id: number, name: string) => Promise<void>;
};

/**
 * One issued token.
 *
 * Everything on the row is something you can act on knowing only this much: what it is
 * called, how much it can do, whether it still works, and when it was last used — that
 * last one being the only evidence available for whether a token is still needed, since
 * nothing else on the account records what a script did.
 */
export function TokenRow({ token, busy, onRotate, onRevoke, onForget }: TokenRowProps) {
  const [confirming, setConfirming] = useState<null | "rotate" | "revoke" | "forget">(null);

  const id = token.id;
  const name = token.name ?? "this token";
  const status = tokenStatus(token);

  const lastUsed = formatRelative(token.lastUsedAt);
  const expiry = token.expiresAt;

  if (id === undefined) return null;

  return (
    <div className="flex flex-col gap-3 p-3.5 transition-colors hover:bg-warm-sunken/60 lg:flex-row lg:items-center lg:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {/*
            * Still, in a list. The dot pulses on the system bar because one thing there is
            * changing; a dozen pulsing dots down a page would just be a page that moves.
            */}
          <StatusDot
            pulse={false}
            tone={status === "active" ? "success" : status === "expired" ? "accent" : "muted"}
          />
          <span className="truncate font-mono text-[13px] font-medium text-warm-black">
            {name}
          </span>

          <Badge tone={token.scope === "Write" ? "accent" : "outline"}>
            {token.scope === "Write" ? "read + write" : "read only"}
          </Badge>

          {status !== "active" ? (
            <Badge tone="neutral">{status === "revoked" ? "revoked" : "expired"}</Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] text-warm-slate">
          <span className="rounded border border-warm-border bg-warm-sunken px-1.5 py-0.5 text-warm-black">
            {token.prefix}…
          </span>

          <span>created {formatDate(token.createdAt)}</span>

          <span>
            {/*
             * "never used" is the useful reading of a null here, not "unknown": the stamp
             * is written on every authenticated request, so its absence is a fact.
             */}
            {lastUsed ? `last used ${lastUsed}` : "never used"}
          </span>

          <span>
            {status === "revoked"
              ? `revoked ${formatDate(token.revokedAt)}`
              : expiry
                ? `${status === "expired" ? "expired" : "expires"} ${formatDate(expiry)}`
                : "no expiry"}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 self-end lg:self-auto">
        {confirming === null ? (
          <>
            {/*
             * Rotate and revoke are only offered while the token still works. Both are
             * meaningless once it does not, and a dead token's only remaining action is to
             * stop being listed.
             */}
            {status === "active" ? (
              <>
                <Button
                  variant="ghost"
                  icon="schedule"
                  disabled={busy}
                  onClick={() => setConfirming("rotate")}
                  title="Issue a new secret for this token, keeping its name and scope"
                >
                  Rotate
                </Button>

                <Button
                  variant="danger"
                  icon="x"
                  disabled={busy}
                  onClick={() => setConfirming("revoke")}
                  title="Stop this token working, permanently"
                >
                  Revoke
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                icon="trash"
                disabled={busy}
                onClick={() => setConfirming("forget")}
                title="Remove this token from the list"
                aria-label={`Remove ${name} from the list`}
              />
            )}
          </>
        ) : (
          <ConfirmStrip
            action={confirming}
            name={name}
            onCancel={() => setConfirming(null)}
            onConfirm={() => {
              const run =
                confirming === "rotate" ? onRotate : confirming === "revoke" ? onRevoke : onForget;

              setConfirming(null);
              void run(id, name);
            }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * The in-row confirmation.
 *
 * All three actions are irreversible in the way that matters — rotating breaks whatever is
 * using the old secret just as thoroughly as revoking does — so each one says what will
 * break rather than only asking whether you are sure.
 */
function ConfirmStrip({
  action,
  name,
  onCancel,
  onConfirm,
}: {
  action: "rotate" | "revoke" | "forget";
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const COPY = {
    rotate: {
      question: "Replace the secret? Anything using the old one stops working.",
      confirm: "Rotate",
      variant: "primary" as const,
    },
    revoke: {
      question: "Revoke for good? This cannot be undone.",
      confirm: "Revoke",
      variant: "danger" as const,
    },
    forget: {
      question: "Remove from the list? The token is already dead.",
      confirm: "Remove",
      variant: "danger" as const,
    },
  }[action];

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="font-mono text-[10.5px] text-warm-slate">{COPY.question}</span>

      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>

      <Button
        autoFocus
        variant={COPY.variant}
        onClick={onConfirm}
        aria-label={`${COPY.confirm} ${name}`}
      >
        {COPY.confirm}
      </Button>
    </div>
  );
}
