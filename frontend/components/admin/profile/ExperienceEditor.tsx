"use client";

import { useId, useRef, useState } from "react";
import type { ExperienceDto, ExperienceInputDto } from "@/lib/api/generated";
import { apiUrl } from "@/lib/api/generated/client";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Field, TextInput } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { PanelHeader } from "../ui/Panel";
import { MarkdownEditor } from "../content/MarkdownEditor";

type ExperienceEditorProps = {
  experiences: ExperienceDto[];
  busy: boolean;
  onCreate: () => Promise<ExperienceDto | null>;
  onUpdate: (id: number, input: ExperienceInputDto) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onUploadLogo: (id: number, file: File) => Promise<void>;
  onRemoveLogo: (id: number) => Promise<void>;
};

/**
 * The timeline the portfolio's experience section is drawn from.
 *
 * Each job is its own row on the API, so each card saves on its own — there is no single
 * Save that would have to reconcile a create, three edits and a delete at once.
 */
export function ExperienceEditor({
  experiences,
  busy,
  onCreate,
  onUpdate,
  onDelete,
  onUploadLogo,
  onRemoveLogo,
}: ExperienceEditorProps) {
  const [openId, setOpenId] = useState<number | null>(null);

  async function create() {
    const created = await onCreate();
    if (created?.id !== undefined) setOpenId(created.id);
  }

  return (
    <div className="flex flex-col gap-4">
      <PanelHeader
        icon="work"
        title="Experience timeline"
        description="Past and present roles. The portfolio draws these along a dated rule, oldest first, and works out every date label from the two you enter here."
        aside={
          <Button icon="add" onClick={() => void create()} disabled={busy}>
            Add role
          </Button>
        }
      />

      {experiences.length === 0 ? (
        <EmptyState
          icon="work"
          title="No roles yet"
          description="The experience section is left off the page entirely until there is at least one."
          action={
            <Button icon="add" onClick={() => void create()} disabled={busy}>
              Add your first role
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {experiences.map((experience) => (
            <li key={experience.id}>
              <ExperienceCard
                experience={experience}
                busy={busy}
                open={openId === experience.id}
                onToggle={() =>
                  setOpenId((current) =>
                    current === experience.id ? null : (experience.id ?? null),
                  )
                }
                onUpdate={onUpdate}
                onDelete={onDelete}
                onUploadLogo={onUploadLogo}
                onRemoveLogo={onRemoveLogo}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type JobDraft = {
  company: string;
  role: string;
  team: string;
  description: string;
  startedOn: string;
  endedOn: string;
};

function ExperienceCard({
  experience,
  busy,
  open,
  onToggle,
  onUpdate,
  onDelete,
  onUploadLogo,
  onRemoveLogo,
}: {
  experience: ExperienceDto;
  busy: boolean;
  open: boolean;
  onToggle: () => void;
  onUpdate: (id: number, input: ExperienceInputDto) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onUploadLogo: (id: number, file: File) => Promise<void>;
  onRemoveLogo: (id: number) => Promise<void>;
}) {
  const ids = useId();
  const logoInput = useRef<HTMLInputElement>(null);

  const saved = toJobDraft(experience);
  const [draft, setDraft] = useState<JobDraft>(saved);
  const [confirming, setConfirming] = useState(false);

  const id = experience.id;
  const logoUrl = apiUrl(experience.logoUrl);
  const isDirty = (Object.keys(draft) as (keyof JobDraft)[]).some((key) => draft[key] !== saved[key]);
  const isCurrent = draft.endedOn === "";

  function update(patch: Partial<JobDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function save() {
    const startedOn = fromMonthInput(draft.startedOn);
    if (id === undefined || !startedOn) return;

    await onUpdate(id, {
      company: draft.company.trim(),
      role: draft.role.trim(),
      team: draft.team.trim() || undefined,
      description: draft.description.trim() || undefined,
      startedOn,
      endedOn: fromMonthInput(draft.endedOn) ?? undefined,
    });
  }

  return (
    <div className="overflow-hidden rounded border border-warm-border bg-warm-surface">
      <div className="flex flex-wrap items-center gap-3 p-3">
        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded border border-warm-border bg-warm-sunken">
          {logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logoUrl} alt="" className="size-full object-contain" />
          ) : (
            <Icon name="work" className="text-[18px] text-warm-accent" />
          )}
        </div>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-accent"
        >
          <span className="min-w-0">
            <span className="block truncate font-serif text-[15px] font-medium text-warm-black">
              {draft.company || "Untitled"}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-warm-slate">
              <span className="truncate">{draft.role || "No role set"}</span>
              <span aria-hidden>•</span>
              <span>{formatRange(draft.startedOn, draft.endedOn)}</span>
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {isCurrent ? <Badge tone="success">Current</Badge> : null}
          {isDirty ? <Badge tone="accent">Unsaved</Badge> : null}

          <Button
            variant="ghost"
            icon={open ? "arrow-up" : "chevron-down"}
            onClick={onToggle}
            aria-label={open ? `Collapse ${draft.company}` : `Edit ${draft.company}`}
          />
        </div>
      </div>

      {open ? (
        <div className="flex flex-col gap-4 border-t border-warm-border bg-warm-sunken/40 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Company" htmlFor={`${ids}-company`}>
              <TextInput
                id={`${ids}-company`}
                value={draft.company}
                disabled={busy}
                maxLength={120}
                onChange={(event) => update({ company: event.target.value })}
                className="text-[13.5px]"
              />
            </Field>

            <Field label="Role" htmlFor={`${ids}-role`}>
              <TextInput
                id={`${ids}-role`}
                value={draft.role}
                disabled={busy}
                maxLength={160}
                placeholder="Senior Systems Engineer"
                onChange={(event) => update({ role: event.target.value })}
                className="text-[13.5px]"
              />
            </Field>
          </div>

          <Field
            label="Team"
            htmlFor={`${ids}-team`}
            hint="Optional. Printed under the role, and as the caption on the timeline node."
          >
            <TextInput
              id={`${ids}-team`}
              value={draft.team}
              disabled={busy}
              maxLength={200}
              placeholder="Edge Compute & Global Serverless Gateway"
              onChange={(event) => update({ team: event.target.value })}
              className="text-[13.5px]"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Started" htmlFor={`${ids}-started`}>
              <TextInput
                id={`${ids}-started`}
                type="month"
                value={draft.startedOn}
                disabled={busy}
                required
                onChange={(event) => update({ startedOn: event.target.value })}
                className="font-mono text-xs"
              />
            </Field>

            <Field
              label="Ended"
              htmlFor={`${ids}-ended`}
              hint='Leave empty for your current role — the timeline then prints "Present".'
            >
              <TextInput
                id={`${ids}-ended`}
                type="month"
                value={draft.endedOn}
                disabled={busy}
                min={draft.startedOn || undefined}
                onChange={(event) => update({ endedOn: event.target.value })}
                className="font-mono text-xs"
              />
            </Field>
          </div>

          <Field label="Description" hint="Markdown. Shown in the panel under the timeline.">
            <MarkdownEditor
              value={draft.description}
              disabled={busy}
              onChange={(description) => update({ description })}
            />
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-warm-border pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={logoInput}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file && id !== undefined) void onUploadLogo(id, file);
                  event.target.value = "";
                }}
              />

              <Button icon="image" disabled={busy} onClick={() => logoInput.current?.click()}>
                {logoUrl ? "Replace logo" : "Upload logo"}
              </Button>

              {logoUrl ? (
                <Button
                  variant="ghost"
                  icon="trash"
                  disabled={busy}
                  onClick={() => id !== undefined && void onRemoveLogo(id)}
                >
                  Clear logo
                </Button>
              ) : (
                <span className="font-mono text-[10.5px] text-warm-slate">
                  Without one the timeline draws the company&apos;s initials.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Two-step rather than a confirm() dialog, as everywhere else destructive. */}
              {confirming ? (
                <Button
                  variant="danger"
                  icon="trash"
                  onClick={() => {
                    if (id !== undefined) void onDelete(id);
                    setConfirming(false);
                  }}
                  onBlur={() => setConfirming(false)}
                  autoFocus
                >
                  Confirm delete
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  icon="trash"
                  disabled={busy}
                  onClick={() => setConfirming(true)}
                  className="hover:bg-warm-danger-bg hover:text-warm-danger"
                >
                  Delete
                </Button>
              )}

              <Button onClick={() => setDraft(saved)} disabled={busy || !isDirty}>
                Revert
              </Button>

              <Button
                variant="primary"
                icon="save"
                onClick={() => void save()}
                disabled={busy || !isDirty || !draft.company.trim() || !draft.role.trim() || !draft.startedOn}
              >
                Save role
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function toJobDraft(experience: ExperienceDto): JobDraft {
  return {
    company: experience.company ?? "",
    role: experience.role ?? "",
    team: experience.team ?? "",
    description: experience.description ?? "",
    startedOn: toMonthInput(experience.startedOn),
    endedOn: toMonthInput(experience.endedOn),
  };
}

/*
 * A job's dates are a month, not a day — nobody's timeline turns on the 14th — so these
 * are edited with <input type="month"> and widened to the first of that month on the way
 * to the API, which stores a date.
 */

function toMonthInput(date: Date | null | undefined): string {
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function fromMonthInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  // Local midnight, which is what the generated client serializes back as a plain date.
  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}

/** "May 2019 — Sep 2021", the same shape the portfolio prints. */
function formatRange(startedOn: string, endedOn: string): string {
  const from = fromMonthInput(startedOn);
  const to = fromMonthInput(endedOn);

  if (!from) return "No start date";

  const format = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "short", year: "numeric" });

  return `${format(from)} — ${to ? format(to) : "Present"}`;
}
