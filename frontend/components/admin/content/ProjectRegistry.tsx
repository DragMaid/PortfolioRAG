"use client";

import type { PostSummaryDto } from "@/lib/api/generated";
import { cn } from "@/lib/cn";
import type { RegistryFilter } from "@/lib/admin/useStudio";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Panel, PanelHeader } from "../ui/Panel";

type RegistryProps = {
  posts: PostSummaryDto[];
  counts: { all: number; live: number; draft: number };
  filter: RegistryFilter;
  onFilterChange: (filter: RegistryFilter) => void;
  activeId: number | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
  creating: boolean;
  state: "loading" | "ready" | "error";
  onRetry: () => void;
};

const FILTERS: { key: RegistryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "draft", label: "Draft" },
];

/** The left column: every project the author owns, drafts included. */
export function ProjectRegistry({
  posts,
  counts,
  filter,
  onFilterChange,
  activeId,
  onSelect,
  onCreate,
  creating,
  state,
  onRetry,
}: RegistryProps) {
  return (
    <Panel className="flex flex-col gap-3 p-4">
      <PanelHeader
        icon="folder"
        title="Project Registry"
        aside={
          <span className="rounded bg-warm-sunken px-2 py-0.5 font-mono text-[11px] text-warm-slate">
            {counts.all} {counts.all === 1 ? "record" : "records"}
          </span>
        }
      />

      <Button icon="add" onClick={onCreate} busy={creating} className="w-full bg-warm-sunken">
        New entry
      </Button>

      <div
        role="tablist"
        aria-label="Filter projects"
        className="grid grid-cols-3 gap-1 rounded border border-warm-border/60 bg-warm-sunken p-1"
      >
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => onFilterChange(key)}
            className={cn(
              "rounded py-1 font-mono text-[11px] transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-warm-accent",
              filter === key
                ? "bg-warm-surface font-medium text-warm-black shadow-sm"
                : "text-warm-slate hover:text-warm-black",
            )}
          >
            {label} ({counts[key]})
          </button>
        ))}
      </div>

      {state === "loading" ? (
        <RegistrySkeleton />
      ) : state === "error" ? (
        <EmptyState
          icon="error"
          title="Registry unavailable"
          description="The project list could not be loaded."
          action={
            <Button onClick={onRetry} icon="folder">
              Try again
            </Button>
          }
        />
      ) : posts.length === 0 ? (
        <EmptyState
          icon="folder"
          title={filter === "all" ? "No projects yet" : `No ${filter} projects`}
          description={
            filter === "all"
              ? "Create the first entry to start writing."
              : "Nothing in the registry matches this filter."
          }
        />
      ) : (
        <ul className="flex flex-col gap-2 pt-1">
          {posts.map((post, index) => (
            <li key={post.id}>
              <ProjectCard
                post={post}
                ordinal={index + 1}
                active={post.id === activeId}
                onSelect={() => post.id !== undefined && onSelect(post.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ProjectCard({
  post,
  ordinal,
  active,
  onSelect,
}: {
  post: PostSummaryDto;
  ordinal: number;
  active: boolean;
  onSelect: () => void;
}) {
  const tags = post.tags ?? [];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={cn(
        "w-full rounded border p-3 text-left transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-accent",
        active
          ? "border-warm-black bg-warm-sunken"
          : "border-warm-border bg-warm-surface hover:bg-warm-sunken",
      )}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="font-serif text-[17px] leading-snug font-medium text-warm-black">
          {post.title || "Untitled"}
        </h3>
        <div className="flex shrink-0 items-center gap-1">
          {post.isFeatured ? <Badge tone="accent">Hero</Badge> : null}
          <Badge tone={post.isDraft ? "neutral" : "success"}>{post.isDraft ? "Draft" : "Live"}</Badge>
        </div>
      </div>

      {post.summary ? (
        <p className="line-clamp-2 text-xs leading-relaxed text-warm-slate">{post.summary}</p>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-warm-border/40 pt-1.5 font-mono text-[10.5px] text-warm-slate">
        <span className={cn("shrink-0", active ? "font-medium text-warm-accent" : "")}>
          #{ordinal.toString().padStart(2, "0")}
        </span>
      </div>
    </button>
  );
}

function RegistrySkeleton() {
  return (
    <div className="flex flex-col gap-2 pt-1" aria-hidden>
      {[0, 1, 2].map((row) => (
        <div key={row} className="rounded border border-warm-border bg-warm-surface p-3">
          <div className="h-4 w-2/3 rounded bg-warm-sunken" />
          <div className="mt-2 h-3 w-full rounded bg-warm-sunken" />
          <div className="mt-1.5 h-3 w-1/2 rounded bg-warm-sunken" />
        </div>
      ))}
    </div>
  );
}
