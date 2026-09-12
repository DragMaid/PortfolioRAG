"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  JobFitVerdict,
  RequirementStatus,
  type EvidenceDto,
  type JobFitReportDto,
  type RequirementAssessmentDto,
} from "@/lib/api/generated";
import { cn } from "@/lib/cn";
import { STATUS_COPY, VERDICT_COPY, confidenceNote } from "@/lib/jobfit/report";

const TONE_RING: Record<string, string> = {
  strong: "border-warm-success/30 bg-warm-success-bg",
  good: "border-warm-accent/35 bg-warm-sunken",
  mixed: "border-warm-border bg-warm-sunken",
  weak: "border-warm-border bg-warm-bg",
};

/**
 * The report, rendered the same way wherever it appears.
 *
 * The shape of this is an argument about what the reader is owed. The score and the prose
 * are at the top because that is what a reader came for; the requirement table is below it
 * and is the part that is actually checkable, with the quote that supports each line shown
 * rather than hidden behind a disclosure. A summary nobody can audit is a summary nobody
 * should act on, and "not shown" lines are rendered at the same weight as the matches
 * instead of being tucked away, because on somebody's own portfolio the temptation to
 * soften the misses is exactly the thing to design against.
 */
export function JobFitReport({ report }: { report: JobFitReportDto }) {
  const essential = (report.requirements ?? []).filter((item) => item.isEssential);
  const optional = (report.requirements ?? []).filter((item) => !item.isEssential);

  return (
    <article className="flex flex-col gap-6">
      <ScoreHeader report={report} />

      {report.summary ? (
        <div className="prose-jobfit max-w-none text-[14px] leading-relaxed text-warm-black">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.summary}</ReactMarkdown>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Column
          title="Strengths"
          items={report.strengths ?? []}
          empty="Nothing in the portfolio lines up with this posting."
        />
        <Column
          title="Gaps"
          items={report.gaps ?? []}
          empty="Nothing the posting asks for is unevidenced."
        />
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="font-mono text-[11px] tracking-wider text-warm-slate uppercase">
          Requirements, one by one
        </h3>

        <ul className="divide-y divide-warm-hairline overflow-hidden rounded border border-warm-border bg-warm-surface">
          {essential.map((requirement, index) => (
            <li key={`essential-${index}`}>
              <Requirement requirement={requirement} />
            </li>
          ))}
        </ul>

        {optional.length > 0 ? (
          <>
            <h4 className="mt-2 font-mono text-[11px] tracking-wider text-warm-slate uppercase">
              Nice to have
            </h4>
            <ul className="divide-y divide-warm-hairline overflow-hidden rounded border border-warm-border bg-warm-surface">
              {optional.map((requirement, index) => (
                <li key={`optional-${index}`}>
                  <Requirement requirement={requirement} />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      {(report.talkingPoints ?? []).length > 0 ? (
        <section className="flex flex-col gap-2 rounded border border-warm-border bg-warm-sunken p-4">
          <h3 className="font-mono text-[11px] tracking-wider text-warm-slate uppercase">
            Worth asking about
          </h3>
          <ul className="flex flex-col gap-1.5 text-[13.5px] leading-relaxed text-warm-black">
            {report.talkingPoints!.map((point, index) => (
              <li key={index} className="flex gap-2">
                <span aria-hidden className="text-warm-accent">
                  —
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <RetrievalNote report={report} />
    </article>
  );
}

function ScoreHeader({ report }: { report: JobFitReportDto }) {
  const verdict = VERDICT_COPY[report.verdict ?? JobFitVerdict.Weak];
  const score = report.score ?? 0;

  return (
    <header
      className={cn(
        "flex flex-wrap items-start gap-5 rounded border p-5",
        TONE_RING[verdict.tone],
      )}
    >
      {/*
       * The number is deliberately large and deliberately explained. It is computed from
       * the requirement statuses rather than asked for from the model, which is what makes
       * it reproducible — and that fact is worth telling a reader who is about to make a
       * judgement with it.
       */}
      <div className="flex shrink-0 flex-col items-center">
        <span className="font-serif text-5xl leading-none font-medium text-warm-black tabular-nums">
          {score}
        </span>
        <span className="mt-1 font-mono text-[10px] tracking-wider text-warm-slate uppercase">
          of 100
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] tracking-wider text-warm-slate uppercase">
          {verdict.label}
        </p>
        <h2 className="mt-1 font-serif text-xl leading-snug font-medium text-warm-black">
          {report.headline}
        </h2>
        <p className="mt-1.5 text-[12.5px] text-warm-slate">{verdict.blurb}</p>
      </div>
    </header>
  );
}

function Requirement({ requirement }: { requirement: RequirementAssessmentDto }) {
  const status = STATUS_COPY[requirement.status ?? RequirementStatus.Missing];
  const hedge = confidenceNote(requirement);

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="min-w-0 flex-1 text-[13.5px] leading-snug text-warm-black">
          {requirement.requirement}
        </p>
        <span
          className={cn(
            "shrink-0 font-mono text-[10.5px] tracking-wider uppercase",
            status.tone,
          )}
        >
          {status.label}
        </span>
      </div>

      <p className="text-[12.5px] leading-relaxed text-warm-slate">
        {requirement.rationale}
        {hedge ? <span className="text-warm-slate/80"> — {hedge}</span> : null}
      </p>

      {(requirement.evidence ?? []).map((evidence, index) => (
        <Evidence key={index} evidence={evidence} />
      ))}
    </div>
  );
}

/**
 * One quotation, attributed.
 *
 * Shown rather than linked or summarised. Every quote here survived being checked against
 * the passage it claims to come from, and putting it in front of the reader is what turns
 * that check from a promise into something they can confirm for themselves.
 */
function Evidence({ evidence }: { evidence: EvidenceDto }) {
  return (
    <figure className="mt-0.5 border-l-2 border-warm-accent/50 pl-3">
      <blockquote className="text-[12.5px] leading-relaxed text-warm-black/85 italic">
        “{evidence.quote}”
      </blockquote>
      <figcaption className="mt-0.5 font-mono text-[10.5px] text-warm-slate">
        {evidence.sourceLabel}
      </figcaption>
    </figure>
  );
}

function Column({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-mono text-[11px] tracking-wider text-warm-slate uppercase">
        {title}
      </h3>
      {items.length > 0 ? (
        <ul className="flex flex-col gap-1.5 text-[13.5px] leading-relaxed text-warm-black">
          {items.map((item, index) => (
            <li key={index} className="flex gap-2">
              <span aria-hidden className="mt-[7px] inline-block size-1 shrink-0 rounded-full bg-warm-accent" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-warm-slate italic">{empty}</p>
      )}
    </section>
  );
}

/**
 * How the answer was arrived at.
 *
 * Small print, but not omitted. A reader deciding something with this is owed the fact
 * that it read a fixed number of passages and nothing else — and the rejected-citation
 * count is the honest admission that the model does sometimes cite things that are not
 * there, and that those were caught rather than printed.
 */
function RetrievalNote({ report }: { report: JobFitReportDto }) {
  const retrieval = report.retrieval;
  if (!retrieval) return null;

  const rejected = retrieval.citationsRejected ?? 0;

  return (
    <footer className="border-t border-warm-hairline pt-3 font-mono text-[10.5px] leading-relaxed text-warm-slate">
      Read {retrieval.passagesConsidered ?? 0} passages of this portfolio across{" "}
      {(retrieval.queries ?? []).length} searches and drew on{" "}
      {retrieval.passagesCited ?? 0}. Every claim above is tied to a passage, and the
      quotations were checked against it.
      {rejected > 0 ? (
        <> {rejected} citation{rejected === 1 ? " was" : "s were"} discarded for not matching
        their source.</>
      ) : null}
    </footer>
  );
}
