"use client";

import { useId, useState } from "react";
import { ApiTokenScope } from "@/lib/api/generated";
import type { TokenDraft } from "@/lib/admin/useApiTokens";
import { Button } from "../ui/Button";
import { Field, TextInput } from "../ui/Field";

/** Offered expiries. Null is "never", which the API stores as no expiry at all. */
const EXPIRIES: { label: string; days: number | null }[] = [
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year", days: 365 },
  { label: "Never", days: null },
];

const EMPTY: TokenDraft = { name: "", scope: ApiTokenScope.Read, expiresInDays: 90 };

/**
 * Issues a token.
 *
 * Defaults to the narrowest useful thing — read-only, ninety days — because the cost of
 * discovering a token is too weak is one more click here, and the cost of discovering it
 * was too strong is not recoverable.
 */
export function IssueTokenForm({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (draft: TokenDraft) => Promise<boolean>;
}) {
  const ids = useId();
  const [draft, setDraft] = useState<TokenDraft>(EMPTY);

  const canIssue = draft.name.trim().length > 0 && !busy;

  async function issue() {
    if (!canIssue) return;

    // Only clears on success: a name the API rejected as a duplicate is the one thing the
    // author needs in front of them to change it.
    if (await onCreate(draft)) setDraft(EMPTY);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void issue();
      }}
      className="flex flex-col gap-3 rounded border border-dashed border-warm-border bg-warm-sunken/40 p-4 lg:grid lg:grid-cols-[minmax(0,1fr)_13rem_10rem_auto] lg:grid-rows-[auto_auto_auto] lg:gap-x-3 lg:gap-y-1.5"
    >
      <Field
        label="Name"
        htmlFor={`${ids}-name`}
        hint="What will hold it — “ci-deploy”, “metrics-bot”."
        className="min-w-0 lg:row-span-3 lg:grid lg:grid-rows-subgrid lg:gap-y-1.5"
      >
        <TextInput
          id={`${ids}-name`}
          value={draft.name}
          disabled={busy}
          maxLength={60}
          placeholder="ci-deploy"
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          className="text-[13.5px]"
        />
      </Field>

      <Field
        label="Scope"
        htmlFor={`${ids}-scope`}
        hint={
          draft.scope === ApiTokenScope.Write
            ? "Can create, edit, publish and delete."
            : "Can only read. Safe for a dashboard."
        }
        className="lg:row-span-3 lg:grid lg:grid-rows-subgrid lg:gap-y-1.5"
      >
        <select
          id={`${ids}-scope`}
          value={draft.scope}
          disabled={busy}
          onChange={(event) =>
            setDraft({ ...draft, scope: event.target.value as ApiTokenScope })
          }
          className="rounded border border-warm-border bg-warm-sunken px-3 py-2 text-[13.5px] text-warm-black transition-colors focus:border-warm-black focus:bg-warm-surface focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value={ApiTokenScope.Read}>Read only</option>
          <option value={ApiTokenScope.Write}>Read + write</option>
        </select>
      </Field>

      <Field
        label="Expires"
        htmlFor={`${ids}-expiry`}
        hint={
          draft.expiresInDays === null
            ? "Lives until you revoke it."
            : "Stops working on its own."
        }
        className="lg:row-span-3 lg:grid lg:grid-rows-subgrid lg:gap-y-1.5"
      >
        <select
          id={`${ids}-expiry`}
          value={String(draft.expiresInDays)}
          disabled={busy}
          onChange={(event) =>
            setDraft({
              ...draft,
              expiresInDays: event.target.value === "null" ? null : Number(event.target.value),
            })
          }
          className="rounded border border-warm-border bg-warm-sunken px-3 py-2 text-[13.5px] text-warm-black transition-colors focus:border-warm-black focus:bg-warm-surface focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {EXPIRIES.map((option) => (
            <option key={option.label} value={String(option.days)}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      <Button
        type="submit"
        variant="primary"
        icon="add"
        disabled={!canIssue}
        busy={busy}
        className="shrink-0 self-start lg:col-start-4 lg:row-start-2 lg:self-stretch"
      >
        Generate
      </Button>
    </form>
  );
}
