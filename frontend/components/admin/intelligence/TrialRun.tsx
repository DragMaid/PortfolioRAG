"use client";

import { useState } from "react";
import type { RagJobDto } from "@/lib/api/generated";
import type { Busy } from "@/lib/admin/useIntelligence";
import { JobFitReport } from "@/components/jobfit/JobFitReport";
import { formatUsage } from "@/lib/jobfit/report";
import { Button } from "../ui/Button";
import { Field, TextArea } from "../ui/Field";
import { Panel, PanelHeader } from "../ui/Panel";

const MINIMUM_CHARS = 120;

/**
 * Running the pipeline against your own portfolio.
 *
 * The same component renders the report here as on the public page, on purpose: this screen
 * is the only rehearsal the public one gets, and a preview that presented the answer
 * differently would be a preview of something else.
 *
 * What is different is the cost line. The owner is paying, so they are shown what it cost;
 * a visitor is not, and the API strips it on that path rather than the client hiding it.
 */
export function TrialRun({
  busy,
  isWorking,
  trial,
  error,
  onRun,
  onClear,
}: {
  busy: Busy;
  isWorking: boolean;
  trial: RagJobDto | null;
  error: string | null;
  onRun: (jobDescription: string) => void;
  onClear: () => void;
}) {
  const [description, setDescription] = useState("");

  const trimmed = description.trim();
  const running = busy === "trying" || isWorking;
  const usage = trial ? formatUsage(trial) : null;

  return (
    <Panel className="flex flex-col gap-4 p-5 sm:p-6">
      <PanelHeader
        icon="sparkle"
        title="Try it yourself"
        description="Run a real posting against your own portfolio and read exactly what a visitor would get. This spends your key and counts against the monthly budget."
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
        htmlFor="trial-jd"
        hint={
          trimmed.length === 0
            ? `At least ${MINIMUM_CHARS} characters.`
            : trimmed.length < MINIMUM_CHARS
              ? `${MINIMUM_CHARS - trimmed.length} more characters needed.`
              : `${trimmed.length.toLocaleString()} characters.`
        }
      >
        <TextArea
          id="trial-jd"
          rows={8}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={running}
          placeholder="Paste a posting you would actually want to be measured against."
          className="text-[13px] leading-relaxed"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          icon="sparkle"
          onClick={() => onRun(description)}
          busy={running}
          disabled={running || trimmed.length < MINIMUM_CHARS}
        >
          {running ? "Running" : "Run the analysis"}
        </Button>

        {trial || error ? (
          <Button variant="ghost" onClick={onClear} disabled={running}>
            Clear
          </Button>
        ) : null}

        {running ? (
          <span className="font-mono text-[11px] text-warm-slate">
            Reads the posting, searches the portfolio, weighs the evidence. Around a minute.
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="rounded border border-warm-danger/25 bg-warm-danger-bg px-3 py-2 text-[12.5px] leading-relaxed text-warm-danger">
          {error}
        </p>
      ) : null}

      {trial?.report ? (
        <div className="border-t border-warm-hairline pt-5">
          <JobFitReport report={trial.report} />
        </div>
      ) : null}
    </Panel>
  );
}
