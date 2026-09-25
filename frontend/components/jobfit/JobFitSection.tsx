"use client";

import { useId, useState } from "react";
import type { JobFitAvailabilityDto } from "@/lib/api/generated";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { cn } from "@/lib/cn";
import { useJobFit } from "@/lib/jobfit/useJobFit";
import { JobDescriptionDropzone } from "./JobDescriptionDropzone";
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
  const fieldId = useId();

  const trimmed = description.trim();
  const tooLong = trimmed.length > (availability.maxJobDescriptionChars ?? 20000);
  const exhausted = (availability.remainingToday ?? 0) <= 0;

  const canSubmit =
    !fit.isBusy && !exhausted && trimmed.length >= MINIMUM_CHARS && !tooLong;

  const maximum = availability.maxJobDescriptionChars ?? 20000;

  return (
    <section id="job-fit" className="scroll-mt-24">
      <SectionHeading
        eyebrow="04 / Job Fit"
        title="Measure a role against this portfolio"
        className="mb-8"
      />

      {/* In the same warm panel as the timeline and the works above it, so the one
          interactive section reads as part of the portfolio rather than a form bolted on. */}
      <SurfaceCard className="p-6 sm:p-10 rounded-sm">
      <form
        className="grid gap-8 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:items-stretch lg:gap-12"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) void fit.submit(description);
        }}
      >
        <div className="flex flex-col gap-5">
          <p className="text-[15px] leading-relaxed text-warm-slate">
            Paste a job description — or drop the file — and this will compare it against what{" "}
            {name} has actually published here: the timeline, the write-ups, the profile. The
            role and the company are read out of the posting, and it says which requirements
            are evidenced and which are not.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                "bg-warm-black px-5 py-3 text-sm font-medium text-warm-bg shadow-subtle transition-[background-color,opacity,transform] duration-150",
                "hover:bg-black dark:hover:bg-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-accent",
                "disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none disabled:hover:bg-warm-black disabled:active:scale-100 rounded-sm",
              )}
            >
              {fit.isBusy ? "Reading the portfolio…" : "Check job fit"}
            </button>

            {fit.state === "done" || fit.state === "error" ? (
              <button
                type="button"
                onClick={fit.reset}
                className="text-sm text-warm-slate underline decoration-warm-border underline-offset-4 transition-colors hover:text-warm-black hover:decoration-warm-black"
              >
                Start over
              </button>
            ) : null}
          </div>

          <Disclosure availability={availability} exhausted={exhausted} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {fit.state === "error" && fit.error ? <Failure message={fit.error} /> : null}

          {fit.isBusy ? (
            <Progress elapsed={fit.elapsed} estimate={fit.estimatedSeconds} />
          ) : null}

          {fit.report ? (
            <JobFitReport report={fit.report} />
          ) : fit.isBusy ? null : (
            // The idle column is the input itself — a big field to paste into or drop a
            // file on — rather than a placeholder describing a report that is not there yet.
            <>
              <label
                htmlFor={`${fieldId}-jd`}
                className="text-sm font-medium text-warm-black"
              >
                Job description
              </label>
              <JobDescriptionDropzone
                id={`${fieldId}-jd`}
                value={description}
                onChange={setDescription}
                disabled={fit.isBusy}
                className="jobfit-arrival flex-1"
                placeholder="Paste the requirements and responsibilities, or drop a .txt / .md file here. The benefits and company blurb are ignored, so there is no need to trim them out."
                footer={
                  <CharacterCount length={trimmed.length} minimum={MINIMUM_CHARS} maximum={maximum} />
                }
              />
            </>
          )}
        </div>
      </form>
      </SurfaceCard>
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
      <p className="text-xs text-warm-slate">
        At least {minimum} characters — a few lines is not enough to read requirements out of.
      </p>
    );
  }

  if (length < minimum) {
    return (
      <p className="text-xs text-warm-slate">
        {minimum - length} more character{minimum - length === 1 ? "" : "s"} needed.
      </p>
    );
  }

  if (length > maximum) {
    return (
      <p className="text-xs text-warm-danger">
        {(length - maximum).toLocaleString()} characters over the limit. Paste the
        requirements rather than the whole page.
      </p>
    );
  }

  return (
    <p className="text-xs text-warm-slate">
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
    <div className="mt-auto flex flex-col gap-2 bg-warm-bg px-4 py-3.5 text-[13px] leading-relaxed text-warm-slate">
      <p>
        {exhausted ? (
          <span className="text-warm-danger">
            You have used all {availability.dailyLimit} of today&rsquo;s checks on this
            portfolio. The allowance resets at midnight UTC.
          </span>
        ) : (
          <>
            <span className="font-mono text-xs text-warm-black tabular-nums">
              {availability.remainingToday} of {availability.dailyLimit}
            </span>{" "}
            checks left today. Each one is answered by a language model paid for by this portfolio&rsquo;s
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
      className="flex flex-col gap-3 border border-warm-border bg-warm-bg p-5"
    >
      <div className="flex items-center justify-between font-mono text-[11px] tracking-wider text-warm-slate uppercase">
        <span>{stages[stage]}…</span>
        <span className="tabular-nums">
          {elapsed}s{elapsed > estimate ? "" : ` / ~${estimate}s`}
        </span>
      </div>

      <div className="h-1 overflow-hidden bg-warm-border">
        <div
          className="h-full bg-warm-accent transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.min(96, (elapsed / estimate) * 100)}%` }}
        />
      </div>

      <p className="text-xs text-warm-slate">
        {elapsed > estimate
          ? "Taking longer than usual. It is still running."
          : "This runs a language model over the portfolio; it is not instant."}
      </p>
    </div>
  );
}

function Failure({ message }: { message: string }) {
  return (
    <div className="border border-warm-danger/25 bg-warm-danger-bg p-5">
      <p className="text-sm font-medium text-warm-danger">
        Could not finish
      </p>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-warm-black">{message}</p>
    </div>
  );
}
