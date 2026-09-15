"use client";

import { useId, useState } from "react";
import type { JobFitAvailabilityDto } from "@/lib/api/generated";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/cn";
import { useJobFit } from "@/lib/jobfit/useJobFit";
import { JobFitReport } from "./JobFitReport";

const MINIMUM_CHARS = 120;

/**
 * The public "Check job fit" section.
 *
 * Only rendered when the owner has a working provider key *and* has chosen to show it —
 * two separate facts, decided on the API, which is why this component takes an availability
 * object rather than working anything out for itself.
 *
 * It is honest about three things a feature like this is usually coy about: that it costs
 * the portfolio's owner money, that the visitor has a limited number of runs, and that it
 * only reads what is published here. All three are stated before the button rather than
 * after the disappointment.
 */
export function JobFitSection({
  handle,
  name,
  availability,
}: {
  handle: string;
  name: string;
  availability: JobFitAvailabilityDto;
}) {
  const fit = useJobFit(handle);
  const [description, setDescription] = useState("");
  const [role, setRole] = useState("");
  const fieldId = useId();

  const trimmed = description.trim();
  const tooLong = trimmed.length > (availability.maxJobDescriptionChars ?? 20000);
  const exhausted = (availability.remainingToday ?? 0) <= 0;

  const canSubmit =
    !fit.isBusy && !exhausted && trimmed.length >= MINIMUM_CHARS && !tooLong;

  return (
    <section id="job-fit" className="scroll-mt-24">
      <SectionHeading
        eyebrow="04 / Job Fit"
        title="Measure a role against this portfolio"
        className="mb-8"
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          <p className="text-[14px] leading-relaxed text-warm-slate">
            Paste a job description and this will compare it against what {name} has
            actually published here — the timeline, the write-ups, the profile — and say
            which requirements are evidenced and which are not.
          </p>

          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSubmit) void fit.submit(description, role);
            }}
          >
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${fieldId}-role`}
                className="font-mono text-[11px] tracking-wider text-warm-slate uppercase"
              >
                Role <span className="normal-case">(optional)</span>
              </label>
              <input
                id={`${fieldId}-role`}
                value={role}
                onChange={(event) => setRole(event.target.value)}
                placeholder="Staff Engineer, Storage"
                disabled={fit.isBusy}
                className="rounded border border-warm-border bg-warm-surface px-3 py-2 text-[14px] text-warm-black transition-colors placeholder:text-warm-slate/60 focus:border-warm-black focus:outline-none disabled:opacity-60"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${fieldId}-jd`}
                className="font-mono text-[11px] tracking-wider text-warm-slate uppercase"
              >
                Job description
              </label>
              <textarea
                id={`${fieldId}-jd`}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={10}
                disabled={fit.isBusy}
                placeholder="Paste the requirements and responsibilities. The benefits and company blurb are ignored, so there is no need to trim them out."
                className="resize-y rounded border border-warm-border bg-warm-surface px-3 py-2 text-[13.5px] leading-relaxed text-warm-black transition-colors placeholder:text-warm-slate/60 focus:border-warm-black focus:outline-none disabled:opacity-60"
              />
              <CharacterCount
                length={trimmed.length}
                minimum={MINIMUM_CHARS}
                maximum={availability.maxJobDescriptionChars ?? 20000}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={!canSubmit}
                className={cn(
                  "rounded bg-warm-black px-4 py-2 font-mono text-[12px] tracking-wide text-warm-surface uppercase transition-colors",
                  "hover:bg-warm-black/88 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-accent",
                  "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-warm-black",
                )}
              >
                {fit.isBusy ? "Reading the portfolio…" : "Check job fit"}
              </button>

              {fit.state === "done" || fit.state === "error" ? (
                <button
                  type="button"
                  onClick={fit.reset}
                  className="font-mono text-[11px] tracking-wider text-warm-slate uppercase underline underline-offset-4 hover:text-warm-black"
                >
                  Start over
                </button>
              ) : null}
            </div>
          </form>

          <Disclosure availability={availability} exhausted={exhausted} />
        </div>

        <div className="min-w-0">
          {fit.isBusy ? (
            <Progress elapsed={fit.elapsed} estimate={fit.estimatedSeconds} />
          ) : null}

          {fit.state === "error" && fit.error ? <Failure message={fit.error} /> : null}

          {fit.report ? <JobFitReport report={fit.report} /> : null}

          {fit.state === "idle" ? <Placeholder /> : null}
        </div>
      </div>
    </section>
  );
}

function CharacterCount({
  length,
  minimum,
  maximum,
}: {
  length: number;
  minimum: number;
  maximum: number;
}) {
  if (length === 0) {
    return (
      <p className="font-mono text-[10.5px] text-warm-slate">
        At least {minimum} characters — a few lines is not enough to read requirements out of.
      </p>
    );
  }

  if (length < minimum) {
    return (
      <p className="font-mono text-[10.5px] text-warm-slate">
        {minimum - length} more character{minimum - length === 1 ? "" : "s"} needed.
      </p>
    );
  }

  if (length > maximum) {
    return (
      <p className="font-mono text-[10.5px] text-warm-danger">
        {(length - maximum).toLocaleString()} characters over the limit. Paste the
        requirements rather than the whole page.
      </p>
    );
  }

  return (
    <p className="font-mono text-[10.5px] text-warm-slate">
      {length.toLocaleString()} / {maximum.toLocaleString()} characters.
    </p>
  );
}

/**
 * What this costs and who it costs.
 *
 * Present because the button spends somebody else's money on a key they supplied, and a
 * visitor who knows that behaves differently from one who does not — which is the entire
 * argument for the per-visitor limit being stated up front rather than discovered at the
 * moment it is hit.
 */
function Disclosure({
  availability,
  exhausted,
}: {
  availability: JobFitAvailabilityDto;
  exhausted: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-warm-border/60 pt-3 font-mono text-[10.5px] leading-relaxed text-warm-slate">
      <p>
        {exhausted ? (
          <span className="text-warm-danger">
            You have used all {availability.dailyLimit} of today&rsquo;s checks on this
            portfolio. The allowance resets at midnight UTC.
          </span>
        ) : (
          <>
            {availability.remainingToday} of {availability.dailyLimit} checks left today.
            Each one is answered by a language model paid for by this portfolio&rsquo;s
            owner.
          </>
        )}
      </p>
      <p>
        It reads {availability.indexedPassages} passages of published work and nothing else
        — no CV, no private drafts, no general knowledge about the person. Anything the
        portfolio does not say, it will tell you it cannot find.
      </p>
    </div>
  );
}

function Progress({ elapsed, estimate }: { elapsed: number; estimate: number }) {
  // The stages are real and in order, so the label tracks roughly where the work is rather
  // than being decoration on a timer.
  const stages = [
    "Reading the posting",
    "Searching the portfolio",
    "Weighing the evidence",
    "Writing it up",
  ];

  const stage = Math.min(stages.length - 1, Math.floor((elapsed / estimate) * stages.length));

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded border border-warm-border bg-warm-sunken p-5"
    >
      <div className="flex items-center justify-between font-mono text-[11px] tracking-wider text-warm-slate uppercase">
        <span>{stages[stage]}…</span>
        <span className="tabular-nums">
          {elapsed}s{elapsed > estimate ? "" : ` / ~${estimate}s`}
        </span>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-warm-border">
        <div
          className="h-full rounded-full bg-warm-accent transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.min(96, (elapsed / estimate) * 100)}%` }}
        />
      </div>

      <p className="font-mono text-[10.5px] text-warm-slate">
        {elapsed > estimate
          ? "Taking longer than usual. It is still running."
          : "This runs a language model over the portfolio; it is not instant."}
      </p>
    </div>
  );
}

function Failure({ message }: { message: string }) {
  return (
    <div className="rounded border border-warm-danger/25 bg-warm-danger-bg p-5">
      <p className="font-mono text-[11px] tracking-wider text-warm-danger uppercase">
        Could not finish
      </p>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-warm-black">{message}</p>
    </div>
  );
}

function Placeholder() {
  return (
    <div className="rounded border border-dashed border-warm-border p-8 text-center">
      <p className="text-[13.5px] leading-relaxed text-warm-slate">
        The analysis will appear here: a score, what is evidenced, what is not, and the
        passage behind every claim.
      </p>
    </div>
  );
}
