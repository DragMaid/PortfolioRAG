"use client";

import { useState } from "react";
import {
  RagSourceStatus,
  RagSourceType,
  type LlmCredentialDto,
  type RagSourceDto,
} from "@/lib/api/generated";
import { formatRelative } from "@/lib/admin/useApiTokens";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "../ui/Icon";
import { Panel, PanelHeader } from "../ui/Panel";

const TYPE_LABEL: Record<RagSourceType, string> = {
  [RagSourceType.Profile]: "Profile",
  [RagSourceType.Experience]: "Experience",
  [RagSourceType.Post]: "Post",
};

const STATUS_COPY: Record<RagSourceStatus, { label: string; icon: IconName; tone: string }> = {
  [RagSourceStatus.Queued]: {
    label: "Queued",
    icon: "schedule",
    tone: "border-warm-border bg-warm-sunken text-warm-slate",
  },
  [RagSourceStatus.Indexing]: {
    label: "Indexing",
    icon: "spinner",
    tone: "border-warm-accent/40 bg-warm-accent/10 text-warm-black",
  },
  [RagSourceStatus.Indexed]: {
    label: "Indexed",
    icon: "check-circle",
    tone: "border-warm-success/30 bg-warm-success-bg text-warm-success",
  },
  [RagSourceStatus.Failed]: {
    label: "Failed",
    icon: "error",
    tone: "border-warm-danger/25 bg-warm-danger-bg text-warm-danger",
  },
};

/**
 * What is retrievable, one row per post, job and profile.
 *
 * Nothing here to press. The server queues a source the moment its content changes and the
 * worker settles it, so this is a read-out: which sources the answers can draw on, which are
 * still on their way in, and — one click on a failed row — why one did not make it.
 */
export function IndexCard({ credential }: { credential: LlmCredentialDto }) {
  const index = credential.index;
  const sources = index?.sources ?? [];
  const passages = index?.documentCount ?? 0;

  const count = (status: RagSourceStatus) => sources.filter((s) => s.status === status).length;
  const pending = count(RagSourceStatus.Queued) + count(RagSourceStatus.Indexing);
  const failed = count(RagSourceStatus.Failed);

  return (
    <Panel className="flex flex-col gap-4 p-5 sm:p-6">
      <PanelHeader
        icon="schema"
        title="Retrieval index"
        description="Your profile, timeline and published posts, cut into passages and embedded so they can be searched. Kept up to date automatically whenever you publish or edit. Drafts are never indexed."
        aside={
          <span className="rounded border border-warm-border bg-warm-sunken px-2 py-0.5 text-[13px] font-medium text-warm-black">
            {passages.toLocaleString()} passages
          </span>
        }
      />

      {sources.length > 0 ? (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-warm-slate">
          <span>{sources.length} sources</span>
          <span>{count(RagSourceStatus.Indexed)} indexed</span>
          {pending > 0 ? <span className="text-warm-black">{pending} in progress</span> : null}
          {failed > 0 ? <span className="text-warm-danger">{failed} failed</span> : null}
          {index?.builtAt ? (
            <span>Last run {formatRelative(index.builtAt) ?? "just now"}</span>
          ) : null}
        </p>
      ) : null}

      {sources.length === 0 ? (
        <p className="rounded border border-warm-border bg-warm-sunken px-3 py-2 text-[13.5px] leading-relaxed text-warm-slate">
          Nothing is indexed yet. Publish a post or add to your timeline and it appears here
          within a few seconds. Until something is indexed the public button stays down —
          an answer grounded in nothing is worse than no answer.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-warm-border">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-warm-border bg-warm-sunken text-xs font-medium text-warm-slate">
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Passages</th>
                <th className="px-3 py-2 text-right font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <SourceRow key={`${source.sourceType}-${source.sourceId}`} source={source} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="border-t border-warm-hairline pt-3 text-xs leading-relaxed text-warm-slate">
        Embedding runs on the worker itself and costs nothing — only analyses and cover letters
        call your provider. Only passages whose text actually changed are re-embedded.
      </p>
    </Panel>
  );
}

function SourceRow({ source }: { source: RagSourceDto }) {
  const [open, setOpen] = useState(false);

  const status = source.status ?? RagSourceStatus.Queued;
  const copy = STATUS_COPY[status];
  const isFailed = status === RagSourceStatus.Failed;
  const updated = status === RagSourceStatus.Indexed ? source.indexedAt : source.queuedAt;

  const chip = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium",
        copy.tone,
      )}
    >
      <Icon
        name={copy.icon}
        className="text-[13.5px]"
      />
      {copy.label}
      {isFailed ? (
        <Icon name="chevron-down" className={cn("text-[13.5px] transition-transform", open && "rotate-180")} />
      ) : null}
    </span>
  );

  return (
    <>
      <tr className="border-b border-warm-hairline last:border-b-0">
        <td className="max-w-[16rem] truncate px-3 py-2 text-sm text-warm-black" title={source.label}>
          {source.label || "Untitled"}
        </td>
        <td className="px-3 py-2 text-[13px] text-warm-slate">
          {source.sourceType ? TYPE_LABEL[source.sourceType] : ""}
        </td>
        <td className="px-3 py-2">
          {isFailed ? (
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              title="Show why it failed"
              className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-accent"
            >
              {chip}
            </button>
          ) : (
            chip
          )}
        </td>
        <td className="px-3 py-2 text-right text-[13px] text-warm-black tabular-nums">
          {status === RagSourceStatus.Indexed || (source.passageCount ?? 0) > 0
            ? (source.passageCount ?? 0).toLocaleString()
            : "—"}
        </td>
        <td className="px-3 py-2 text-right text-[13px] text-warm-slate">
          {updated ? (formatRelative(updated) ?? "just now") : "—"}
        </td>
      </tr>

      {isFailed && open ? (
        <tr className="border-b border-warm-hairline bg-warm-danger-bg/60 last:border-b-0">
          <td colSpan={5} className="px-3 py-2.5 text-[13.5px] leading-relaxed text-warm-danger">
            {source.error ?? "The worker did not say why."}
            <span className="mt-1 block text-xs text-warm-slate">
              It is retried automatically the next time this source changes or the index runs.
              {(source.passageCount ?? 0) > 0
                ? " Its previous passages are still searchable in the meantime."
                : ""}
            </span>
          </td>
        </tr>
      ) : null}
    </>
  );
}
