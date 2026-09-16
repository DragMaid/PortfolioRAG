"use client";

import type { LlmCredentialDto } from "@/lib/api/generated";
import type { Busy, ExposureDraft } from "@/lib/admin/useIntelligence";
import { formatUsd } from "@/lib/jobfit/report";
import { cn } from "@/lib/cn";
import { Button } from "../ui/Button";
import { Field, TextInput } from "../ui/Field";
import { Panel, PanelHeader } from "../ui/Panel";
import { Toggle } from "../ui/Toggle";

/**
 * Who may spend the key, and how much.
 *
 * The toggle is the consent, deliberately separate from having supplied a working key — so
 * this card is where a reader decides to put a paid feature in front of strangers, and it
 * shows them the three ceilings and what is left of each before they do.
 */
export function ExposureCard({
  credential,
  draft,
  busy,
  isDirty,
  onChange,
  onSave,
}: {
  credential: LlmCredentialDto;
  draft: ExposureDraft;
  busy: Busy;
  isDirty: boolean;
  onChange: <K extends keyof ExposureDraft>(key: K, value: ExposureDraft[K]) => void;
  onSave: () => void;
}) {
  const locked = busy !== null;
  const usable = credential.isUsable ?? false;

  const spent = credential.monthlySpendUsd ?? 0;
  const budget = credential.monthlyBudgetUsd ?? 0;
  const served = credential.monthlyRequestCount ?? 0;

  return (
    <Panel className="flex flex-col gap-5 p-5 sm:p-6">
      <PanelHeader
        icon="share"
        title="Public access"
        description="Whether visitors to your portfolio get a “Check job fit” button, and what it is allowed to cost you."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Toggle
          id="public-fit"
          label="Show it on my portfolio"
          checked={draft.isPublicFitEnabled}
          onChange={(next) => onChange("isPublicFitEnabled", next)}
          disabled={locked || !usable}
        />

        {!usable ? (
          <p className="text-[13.5px] text-warm-slate">
            Confirm the key with the provider first.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Per visitor, per day"
          htmlFor="daily-limit"
          hint="Counted per reader, resets at midnight UTC."
        >
          <TextInput
            id="daily-limit"
            type="number"
            min={1}
            max={1000}
            value={draft.dailyVisitorLimit}
            onChange={(event) => onChange("dailyVisitorLimit", Number(event.target.value))}
            disabled={locked}
          />
        </Field>

        <Field
          label="Per month, all visitors"
          htmlFor="monthly-limit"
          hint={`${served.toLocaleString()} used so far this month.`}
        >
          <TextInput
            id="monthly-limit"
            type="number"
            min={1}
            max={100000}
            value={draft.monthlyAccountLimit}
            onChange={(event) => onChange("monthlyAccountLimit", Number(event.target.value))}
            disabled={locked}
          />
        </Field>

        <Field
          label="Monthly budget (USD)"
          htmlFor="budget"
          hint="A long posting costs several times what a short one does, so this bounds the bill where a count cannot."
        >
          <TextInput
            id="budget"
            type="number"
            min={0}
            max={10000}
            step="0.5"
            value={draft.monthlyBudgetUsd}
            onChange={(event) => onChange("monthlyBudgetUsd", Number(event.target.value))}
            disabled={locked}
          />
        </Field>
      </div>

      <SpendMeter spent={spent} budget={budget} />

      {(credential.availableModels ?? []).length > 0 ? (
        <Field
          label="Model"
          htmlFor="model"
          hint="What your key is allowed to use, as the provider last reported it."
        >
          <select
            id="model"
            value={draft.model}
            onChange={(event) => onChange("model", event.target.value)}
            disabled={locked}
            className="rounded border border-warm-border bg-warm-sunken px-3 py-2 font-mono text-sm text-warm-black focus:border-warm-black focus:bg-warm-surface focus:outline-none disabled:opacity-60"
          >
            {(credential.availableModels ?? []).map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <Field label="Model" htmlFor="model-text">
          <TextInput
            id="model-text"
            value={draft.model}
            onChange={(event) => onChange("model", event.target.value)}
            disabled={locked}
            className="font-mono text-sm"
          />
        </Field>
      )}

      <div className="flex items-center gap-3 border-t border-warm-hairline pt-4">
        <Button
          variant="primary"
          icon="save"
          onClick={onSave}
          busy={busy === "saving"}
          disabled={locked || !isDirty}
        >
          Save
        </Button>
        {isDirty ? (
          <span className="text-[13px] font-medium text-warm-accent-ink">
            Unsaved changes
          </span>
        ) : null}
      </div>
    </Panel>
  );
}

/**
 * What the month has cost against what it is allowed to.
 *
 * A bar rather than a number, because the decision it informs is "is this about to stop
 * working", and that is a proportion. It turns the same colour as a destructive action
 * once it is nearly full — the feature really does switch itself off at the line.
 */
function SpendMeter({ spent, budget }: { spent: number; budget: number }) {
  const fraction = budget > 0 ? Math.min(1, spent / budget) : 0;
  const nearlyFull = fraction >= 0.8;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-[13px] font-medium text-warm-slate">
        <span>This month</span>
        <span className={cn("tabular-nums", nearlyFull && "text-warm-danger")}>
          {formatUsd(spent)} / {formatUsd(budget)}
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-warm-sunken">
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            nearlyFull ? "bg-warm-danger" : "bg-warm-accent",
          )}
          style={{ width: `${Math.max(fraction * 100, spent > 0 ? 2 : 0)}%` }}
        />
      </div>

      {fraction >= 1 ? (
        <p className="text-xs text-warm-danger">
          The budget is spent. Visitors are being turned away until the month turns over, or
          until you raise it.
        </p>
      ) : null}
    </div>
  );
}
