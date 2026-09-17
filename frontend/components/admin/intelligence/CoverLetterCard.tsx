"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RagSourceType, type RagJobDto } from "@/lib/api/generated";
import type { Busy } from "@/lib/admin/useIntelligence";
import { formatUsage, isPending } from "@/lib/jobfit/report";
import { Button } from "../ui/Button";
import { Field, TextArea } from "../ui/Field";
import { Panel, PanelHeader } from "../ui/Panel";

const MINIMUM_CHARS = 120;
const MAXIMUM_NOTES = 1000;

const SOURCE_LABEL: Record<RagSourceType, string> = {
  [RagSourceType.Profile]: "Profile",
  [RagSourceType.Experience]: "Experience",
  [RagSourceType.Post]: "Post",
};

/**
 * A cover letter for a posting, drafted from the published portfolio.
 *
 * Owner-only, and a draft: the author reads and edits it before it goes anywhere, which is
 * why it ends in a copy button rather than a send. The role and company are read out of the
 * posting, and shown above the letter so a misreading is caught before the letter is used.
 * The sources are listed under it for the same reason the analysis cites its passages.
 */
export function CoverLetterCard({
  busy,
  isWorking,
  job,
  error,
  onWrite,
  onClear,
}: {
  busy: Busy;
  isWorking: boolean;
  job: RagJobDto | null;
  error: string | null;
  onWrite: (jobDescription: string, notes: string) => void;
  onClear: () => void;
}) {
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const trimmed = description.trim();
  const blocked = busy !== null || isWorking;
  const writing = busy === "writing" || (isWorking && isPending(job));
  const letter = job?.coverLetter ?? null;
  const usage = job ? formatUsage(job) : null;

  return (
    <Panel className="flex flex-col gap-4 p-5 sm:p-6">
      <PanelHeader
        icon="edit-note"
        title="Draft a cover letter"
        description="Paste a posting and get a first draft in your voice, written only from what your portfolio shows. The role and company are read out of the posting. This spends your key and counts against the monthly budget."
        aside={
          usage ? (
            <span className="rounded border border-warm-border bg-warm-sunken px-2 py-0.5 font-mono text-[10.5px] text-warm-slate">
              {usage}
            </span>
          ) : null
        }
      />

      <Field
        label="Job description"
        htmlFor="letter-jd"
        hint={
          trimmed.length === 0
            ? `At least ${MINIMUM_CHARS} characters. Include the title line if the posting has one.`
            : trimmed.length < MINIMUM_CHARS
              ? `${MINIMUM_CHARS - trimmed.length} more characters needed.`
              : `${trimmed.length.toLocaleString()} characters.`
        }
      >
        <TextArea
          id="letter-jd"
          rows={8}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={writing}
          placeholder="Paste the posting as it is."
          className="text-[13px] leading-relaxed"
        />
      </Field>

      <Field
        label="Notes (optional)"
        htmlFor="letter-notes"
        hint={`${notes.length} / ${MAXIMUM_NOTES}. Tone, a project to lead with, something to leave out.`}
      >
        <TextArea
          id="letter-notes"
          rows={2}
          maxLength={MAXIMUM_NOTES}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          disabled={writing}
          placeholder="Lead with the storage work; keep it short."
          className="text-[13px] leading-relaxed"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          icon="edit-note"
          onClick={() => onWrite(description, notes)}
          busy={writing}
          disabled={blocked || trimmed.length < MINIMUM_CHARS}
        >
          {writing ? "Writing" : "Write the letter"}
        </Button>

        {job || error ? (
          <Button variant="ghost" onClick={onClear} disabled={writing}>
            Clear
          </Button>
        ) : null}

        {writing ? (
          <span className="font-mono text-[11px] text-warm-slate">
            Reads the posting, searches the portfolio, drafts the letter. Around half a minute.
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="rounded border border-warm-danger/25 bg-warm-danger-bg px-3 py-2 text-[12.5px] leading-relaxed text-warm-danger">
          {error}
        </p>
      ) : null}

      {letter ? (
        <article className="flex flex-col gap-4 border-t border-warm-hairline pt-5">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[11px] tracking-wider text-warm-slate uppercase">
                Read the posting as
              </p>
              <h3 className="mt-0.5 font-serif text-lg leading-snug font-medium text-warm-black">
                {letter.roleTitle || "An unnamed role"}
                {letter.company ? (
                  <span className="text-warm-slate"> at {letter.company}</span>
                ) : null}
              </h3>
            </div>
            <CopyButton text={letter.letter ?? ""} />
          </header>

          <div className="prose-studio max-w-none rounded border border-warm-border bg-warm-bg px-5 py-4 text-[14px] leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{letter.letter ?? ""}</ReactMarkdown>
          </div>

          <footer className="flex flex-col gap-1.5">
            <p className="font-mono text-[11px] tracking-wider text-warm-slate uppercase">
              Drawn from
            </p>
            {(letter.sources ?? []).length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {letter.sources!.map((source) => (
                  <li
                    key={source.documentId}
                    className="rounded border border-warm-border bg-warm-sunken px-2 py-0.5 font-mono text-[10.5px] text-warm-slate"
                  >
                    {SOURCE_LABEL[source.sourceType ?? RagSourceType.Post]} ·{" "}
                    <span className="text-warm-black">{source.sourceLabel}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-warm-slate italic">
                The letter cited no passages. Read it closely before using it.
              </p>
            )}
          </footer>
        </article>
      ) : null}
    </Panel>
  );
}

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <Button
      icon={state === "copied" ? "check-circle" : "copy"}
      onClick={() =>
        void navigator.clipboard.writeText(text).then(
          () => setState("copied"),
          () => setState("failed"),
        )
      }
    >
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy"}
    </Button>
  );
}
