"use client";

import { useId, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RagSourceType, type CoverLetterDto } from "@/lib/api/generated";
import { JobDescriptionDropzone } from "@/components/jobfit/JobDescriptionDropzone";
import { useCoverLetter } from "@/lib/admin/useCoverLetter";
import { useToast } from "@/lib/admin/useToast";
import { formatUsd } from "@/lib/jobfit/report";
import { Button } from "../ui/Button";
import { Field, TextArea } from "../ui/Field";
import { Panel, PanelHeader } from "../ui/Panel";

const MINIMUM_CHARS = 120;

const SOURCE_LABEL: Record<RagSourceType, string> = {
  [RagSourceType.Profile]: "Profile",
  [RagSourceType.Experience]: "Experience",
  [RagSourceType.Post]: "Post",
};

/**
 * A cover letter for a posting, written from the indexed portfolio.
 *
 * Studio-only: the letter is the author's own draft, so it is shown with what it drew on and
 * a copy button, and nothing about it is exposed to visitors.
 */
export function CoverLetterCard({ onFinished }: { onFinished?: () => void }) {
  const ids = useId();
  const { showToast } = useToast();
  const cover = useCoverLetter(onFinished);

  const [jobDescription, setJobDescription] = useState("");
  const [notes, setNotes] = useState("");

  const trimmed = jobDescription.trim();
  const canWrite = !cover.isBusy && trimmed.length >= MINIMUM_CHARS;

  async function copy(letter: string) {
    try {
      await navigator.clipboard.writeText(letter);
      showToast("Copied the letter");
    } catch {
      showToast("Clipboard unavailable in this browser context", "error");
    }
  }

  return (
    <Panel className="flex flex-col gap-4 p-5 sm:p-6">
      <PanelHeader
        icon="edit-note"
        title="Cover letter"
        description="Paste a job description and get a first draft written from your own posts, timeline and profile — nothing it cannot find there. The role and company are read out of the posting. Spends your key and counts against the monthly budget."
      />

      <Field label="Job description" htmlFor={`${ids}-jd`}>
        <JobDescriptionDropzone
          id={`${ids}-jd`}
          value={jobDescription}
          onChange={setJobDescription}
          disabled={cover.isBusy}
          footer={
            <span className="text-xs text-warm-slate">
              {trimmed.length === 0
                ? `At least ${MINIMUM_CHARS} characters.`
                : trimmed.length < MINIMUM_CHARS
                  ? `${MINIMUM_CHARS - trimmed.length} more characters needed.`
                  : `${trimmed.length.toLocaleString()} characters.`}
            </span>
          }
        />
      </Field>

      <Field
        label="Notes (optional)"
        htmlFor={`${ids}-notes`}
        hint="Anything to lean on or leave out — a project to lead with, a tone."
      >
        <TextArea
          id={`${ids}-notes`}
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={1000}
          disabled={cover.isBusy}
          placeholder="Lead with the storage engine work. Keep it short."
          className="text-sm"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          icon="sparkle"
          busy={cover.isBusy}
          disabled={!canWrite}
          onClick={() => void cover.write({ jobDescription, notes })}
        >
          {cover.isBusy ? "Writing" : cover.letter ? "Write another" : "Write the letter"}
        </Button>

        {cover.letter || cover.error ? (
          <Button variant="ghost" onClick={cover.clear} disabled={cover.isBusy}>
            Clear
          </Button>
        ) : null}

        {cover.isBusy ? (
          <span className="text-[13px] text-warm-slate tabular-nums">
            Reading the posting, searching your portfolio, writing… {cover.elapsed}s
            {cover.elapsed <= cover.estimatedSeconds ? ` / ~${cover.estimatedSeconds}s` : ""}
          </span>
        ) : null}
      </div>

      {cover.error ? (
        <p className="rounded border border-warm-danger/25 bg-warm-danger-bg px-3 py-2 text-[13.5px] leading-relaxed text-warm-danger">
          {cover.error}
        </p>
      ) : null}

      {cover.letter ? <Letter letter={cover.letter} onCopy={(text) => void copy(text)} /> : null}
    </Panel>
  );
}

function Letter({ letter, onCopy }: { letter: CoverLetterDto; onCopy: (text: string) => void }) {
  const usage = letter.usage;

  return (
    <div className="flex flex-col gap-4 border-t border-warm-hairline pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-medium text-warm-slate">
          {letter.roleTitle}
          {letter.company ? ` · ${letter.company}` : ""}
        </div>
        <div className="flex items-center gap-2">
          {usage ? (
            <span className="rounded border border-warm-border bg-warm-sunken px-2 py-0.5 text-xs text-warm-slate">
              {formatUsd(usage.costUsd ?? 0)} · {Math.round((usage.durationMs ?? 0) / 1000)}s
            </span>
          ) : null}
          <Button icon="copy" onClick={() => onCopy(letter.letter ?? "")}>
            Copy
          </Button>
        </div>
      </div>

      <div className="prose-studio rounded border border-warm-border bg-warm-surface p-5">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{letter.letter ?? ""}</ReactMarkdown>
      </div>

      {(letter.sources ?? []).length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-warm-slate">
            Drawn from
          </span>
          <ul className="flex flex-wrap gap-1.5">
            {(letter.sources ?? []).map((source) => (
              <li
                key={source.documentId}
                className="rounded border border-warm-border bg-warm-sunken px-2 py-0.5 text-[13px] text-warm-black"
              >
                <span className="text-warm-slate">
                  {source.sourceType ? SOURCE_LABEL[source.sourceType] : ""}:
                </span>{" "}
                {source.sourceLabel}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs leading-relaxed text-warm-slate">
        A first draft. Read it before sending — it only knows what your portfolio says.
      </p>
    </div>
  );
}
