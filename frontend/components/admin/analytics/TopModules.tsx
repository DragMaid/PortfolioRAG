import type { TopPostDto } from "@/lib/api/generated";
import { formatCount, formatShare } from "@/lib/admin/format";
import { EmptyState } from "../ui/EmptyState";
import { Panel, PanelHeader } from "../ui/Panel";

/** The author's most-read projects in the window, as a ranked list with share bars. */
export function TopModules({ posts }: { posts: TopPostDto[] }) {
  return (
    <Panel className="flex flex-col gap-4 p-5">
      <PanelHeader
        icon="verified"
        title="Top viewed projects"
        aside={<span className="font-mono text-[11px] text-warm-slate">Reads</span>}
      />

      {posts.length === 0 ? (
        <EmptyState
          icon="stories"
          title="Nothing read yet"
          description="Published projects appear here as readers find them."
        />
      ) : (
        <ol className="flex flex-col gap-3">
          {posts.map((post) => (
            <li
              key={post.postId}
              className="flex flex-col gap-1.5 rounded border border-warm-border/60 bg-warm-sunken p-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-serif text-[15px] font-medium text-warm-black">
                  {post.title}
                </span>
                <span className="shrink-0 font-mono text-xs font-semibold text-warm-black">
                  {formatCount(post.reads ?? 0)}
                </span>
              </div>

              {post.summary ? (
                <p className="line-clamp-2 text-[11.5px] leading-relaxed text-warm-slate">
                  {post.summary}
                </p>
              ) : null}

              <div className="mt-1 flex items-center gap-2">
                <span className="h-1 flex-1 overflow-hidden rounded bg-warm-raised">
                  <span
                    className="block h-full bg-warm-black"
                    style={{ width: `${Math.min(100, (post.share ?? 0) * 100)}%` }}
                  />
                </span>
                <span className="font-mono text-[10.5px] text-warm-slate">
                  {formatShare(post.share ?? 0)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
