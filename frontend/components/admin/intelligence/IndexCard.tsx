"use client";

import type { LlmCredentialDto } from "@/lib/api/generated";
import type { Busy } from "@/lib/admin/useIntelligence";
import { formatRelative } from "@/lib/admin/useApiTokens";
import { Button } from "../ui/Button";
import { Panel, PanelHeader } from "../ui/Panel";

/**
 * What is retrievable, and how fresh it is.
 *
 * The rebuild button is a convenience rather than the mechanism: the worker checks the
 * index against the portfolio before every analysis and brings it up to date if anything
 * has moved, so an answer is never drawn from a stale index whether or not anybody presses
 * this. It is here for the case where somebody has just published and wants to watch the
 * count go up.
 */
export function IndexCard({
  credential,
  busy,
  isWorking,
  onRebuild,
}: {
  credential: LlmCredentialDto;
  busy: Busy;
  isWorking: boolean;
  onRebuild: () => void;
}) {
  const index = credential.index;
  const passages = index?.documentCount ?? 0;
  const pending = index?.pendingJob ?? null;
  const running = isWorking || pending !== null;

  return (
    <Panel className="flex flex-col gap-4 p-5 sm:p-6">
      <PanelHeader
        icon="schema"
        title="Retrieval index"
        description="Your profile, timeline and published posts, cut into passages and embedded so they can be searched. Drafts are never indexed."
        aside={
          <span className="rounded border border-warm-border bg-warm-sunken px-2 py-0.5 font-mono text-[11px] font-medium text-warm-black">
            {passages.toLocaleString()} passages
          </span>
        }
      />

      {passages === 0 && !running ? (
        <p className="rounded border border-warm-border bg-warm-sunken px-3 py-2 text-[12.5px] leading-relaxed text-warm-slate">
          Nothing is indexed yet, so the public button stays down however the toggle is set —
          an answer grounded in nothing is worse than no answer. Publish something, or
          rebuild below.
        </p>
      ) : null}

      {index?.error ? (
        <p className="rounded border border-warm-danger/25 bg-warm-danger-bg px-3 py-2 text-[12.5px] leading-relaxed text-warm-danger">
          The last rebuild failed: {index.error} The previous index is still in place and
          still answering.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          icon="schema"
          onClick={onRebuild}
          busy={busy === "rebuilding" || running}
          disabled={busy !== null || running}
        >
          {running ? "Rebuilding" : "Rebuild now"}
        </Button>

        <span className="font-mono text-[11px] text-warm-slate">
          {running
            ? "This takes a few seconds."
            : index?.builtAt
              ? `Last built ${formatRelative(index.builtAt) ?? "just now"}`
              : "Never built"}
        </span>
      </div>

      <p className="border-t border-warm-hairline pt-3 font-mono text-[10.5px] leading-relaxed text-warm-slate">
        Embedding runs on the worker itself and costs nothing — only the analysis calls your
        provider. Rebuilding re-reads everything but only re-embeds passages whose text has
        actually changed.
      </p>
    </Panel>
  );
}
