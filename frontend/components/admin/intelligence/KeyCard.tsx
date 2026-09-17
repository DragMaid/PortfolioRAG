"use client";

import { useState } from "react";
import type { LlmCredentialDto, LlmProvider, LlmProviderDto } from "@/lib/api/generated";
import type { Busy } from "@/lib/admin/useIntelligence";
import { formatRelative } from "@/lib/admin/useApiTokens";
import { Button } from "../ui/Button";
import { Field, TextInput } from "../ui/Field";
import { Panel, PanelHeader } from "../ui/Panel";

/**
 * Entering, replacing and removing the provider key.
 *
 * There is no "edit" — the API cannot read a stored key back, so a new one always
 * supersedes. The form says so rather than pretending otherwise, because a field that looks
 * editable and is not is worse than one that is plainly a replacement.
 */
export function KeyCard({
  credential,
  providers,
  busy,
  onSave,
  onRevalidate,
  onRemove,
}: {
  credential: LlmCredentialDto | null;
  providers: LlmProviderDto[];
  busy: Busy;
  onSave: (provider: LlmProvider, apiKey: string, model?: string) => Promise<boolean>;
  onRevalidate: () => void;
  onRemove: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  // Null until the author picks one, unless there is only one to pick or a key is being
  // replaced, where the stored provider is the likely answer. Never silently Anthropic.
  const [chosen, setChosen] = useState<LlmProvider | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const locked = busy !== null;
  const showForm = credential === null || replacing;

  const provider =
    chosen ??
    credential?.provider ??
    (providers.length === 1 ? (providers[0].provider ?? null) : null);
  const selected = providers.find((option) => option.provider === provider);

  const providerName = (value: LlmProvider | undefined) =>
    providers.find((option) => option.provider === value)?.displayName ?? value ?? "";

  return (
    <Panel className="flex flex-col gap-4 p-5 sm:p-6">
      <PanelHeader
        icon="key"
        title="Provider key"
        description="Your own key with a model provider. It is encrypted before it is stored, never shown again, and never reachable from an API token."
        aside={credential ? <KeyStatus credential={credential} /> : null}
      />

      {credential ? (
        <dl className="grid gap-x-6 gap-y-2 rounded border border-warm-border bg-warm-sunken p-4 sm:grid-cols-2">
          <Detail label="Key" value={credential.keyPreview ?? ""} mono />
          <Detail label="Model" value={credential.model ?? ""} mono />
          <Detail label="Provider" value={providerName(credential.provider)} />
          <Detail
            label="Last checked"
            value={
              credential.validatedAt
                ? (formatRelative(credential.validatedAt) ?? "just now")
                : "never"
            }
          />
        </dl>
      ) : null}

      {credential?.validationError ? (
        <p className="rounded border border-warm-danger/25 bg-warm-danger-bg px-3 py-2 text-[13.5px] leading-relaxed text-warm-danger">
          {credential.validationError}
        </p>
      ) : null}

      {showForm ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (provider === null) return;
            if (await onSave(provider, apiKey)) {
              setApiKey("");
              setChosen(null);
              setReplacing(false);
            }
          }}
        >
          <Field
            label="Provider"
            htmlFor="llm-provider"
            hint={
              selected
                ? `New keys use ${selected.defaultModel} until you choose another model.`
                : "The vendor the key was issued by. It is checked with them, so the wrong one is refused."
            }
          >
            <select
              id="llm-provider"
              value={provider ?? ""}
              onChange={(event) => setChosen(event.target.value as LlmProvider)}
              disabled={locked || providers.length === 0}
              required
              className="rounded border border-warm-border bg-warm-sunken px-3 py-2 text-sm text-warm-black focus:border-warm-black focus:bg-warm-surface focus:outline-none disabled:opacity-60"
            >
              {provider === null ? (
                <option value="" disabled>
                  Choose a provider
                </option>
              ) : null}
              {providers.map((option) => (
                <option key={option.provider} value={option.provider}>
                  {option.displayName}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label={credential ? "Replace the key" : "API key"}
            htmlFor="llm-key"
            hint="Checked with the provider before it is stored. A key they refuse is not saved at all, so a wrong paste cannot take out a working one."
          >
            <TextInput
              id="llm-key"
              // NOTE: a password field, and autocomplete off. Not because it is a password
              // — it is worth rather more — but because that is the one input treatment
              // browsers do not offer to remember, sync or print.
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={selected?.keyPlaceholder ?? "Choose a provider first"}
              disabled={locked}
              className="font-mono text-sm"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              variant="primary"
              icon="check-circle"
              busy={busy === "saving"}
              disabled={locked || provider === null || apiKey.trim().length === 0}
            >
              Check and store
            </Button>

            {credential ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setReplacing(false);
                  setApiKey("");
                  setChosen(null);
                }}
                disabled={locked}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button icon="key" onClick={() => setReplacing(true)} disabled={locked}>
            Replace key
          </Button>
          <Button
            icon="verified"
            onClick={onRevalidate}
            busy={busy === "validating"}
            disabled={locked}
          >
            Re-check with provider
          </Button>

          {confirming ? (
            <>
              <Button
                variant="danger"
                icon="trash"
                onClick={onRemove}
                busy={busy === "deleting"}
                disabled={locked}
              >
                Remove it, and the index
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={locked}>
                Keep it
              </Button>
            </>
          ) : (
            <Button variant="ghost" icon="trash" onClick={() => setConfirming(true)} disabled={locked}>
              Remove
            </Button>
          )}
        </div>
      )}

      {confirming && !showForm ? (
        <p className="text-[13.5px] leading-relaxed text-warm-slate">
          Removing the key also cancels anything queued against it and deletes the passages
          it indexed. Your posts and timeline are untouched; the index is rebuilt from them
          the next time you add a key.
        </p>
      ) : null}
    </Panel>
  );
}

function KeyStatus({ credential }: { credential: LlmCredentialDto }) {
  const usable = credential.isUsable ?? false;

  return (
    <span
      className={
        usable
          ? "rounded border border-warm-success/30 bg-warm-success-bg px-2 py-0.5 text-[13px] font-medium text-warm-success"
          : "rounded border border-warm-danger/25 bg-warm-danger-bg px-2 py-0.5 text-[13px] font-medium text-warm-danger"
      }
    >
      {usable ? "verified" : "not verified"}
    </span>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[13px] font-medium text-warm-slate">
        {label}
      </dt>
      <dd className={mono ? "font-mono text-[13.5px] text-warm-black" : "text-sm text-warm-black"}>
        {value || "—"}
      </dd>
    </div>
  );
}
