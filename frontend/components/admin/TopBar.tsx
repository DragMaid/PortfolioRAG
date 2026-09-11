"use client";

import type { PostDto } from "@/lib/api/generated";
import { useAuth } from "@/lib/admin/useAuth";
import { cn } from "@/lib/cn";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { StatusDot } from "./ui/StatusDot";

type TopBarProps = {
  post: PostDto | null;
  isDirty: boolean;
  busy: null | "saving" | "publishing" | "creating";
  /** False on a tab whose screen saves itself, where the three post actions do nothing. */
  showPostActions: boolean;
  /** What the open project still needs before it can go live, if anything. */
  publishBlockers: string[];
  onSave: () => void;
  onPublish: () => void;
  onDiscard: () => void;
};

/**
 * The system bar: who is signed in, whether there is anything unsaved, and the three
 * actions that act on the open project.
 */
export function TopBar({
  post,
  isDirty,
  busy,
  showPostActions,
  publishBlockers,
  onSave,
  onPublish,
  onDiscard,
}: TopBarProps) {
  const { session, signOut } = useAuth();

  const canAct = post !== null && busy === null;

  // The reader-facing address, not the API's. Only offered once the post is published,
  // since a draft has nothing to look at.
  // TODO(review): /posts/[slug] is the public route being built on the portfolio branch —
  // this link 404s until that lands. Pointing it at the API's JSON instead would resolve
  // today but is not what "view live" means.
  const liveUrl = post && !post.isDraft && post.slug ? `/posts/${post.slug}` : null;

  return (
    <header className="sticky top-0 z-40 border-b border-warm-border bg-warm-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <span className="flex items-center gap-2">
            <span aria-hidden className="inline-block size-2.5 rounded-full bg-warm-black" />
            <span className="font-mono text-[13px] font-semibold tracking-tight text-warm-black">
              {session?.authorName || "Admin"}{" "}
              <span className="font-normal text-warm-slate">/ Studio</span>
            </span>
          </span>

          <span aria-hidden className="hidden h-4 w-px bg-warm-border sm:block" />

          {/*
           * The prototype showed a fixed "Production Live • Synced". This reports the real
           * state of the open project instead — a status line that is always green is not
           * a status line.
           */}
          {/* TODO(review): deviates from the prototype's always-green status pill. */}
          <span
            className={cn(
              "hidden items-center gap-2 rounded border px-2.5 py-1 sm:flex",
              isDirty
                ? "border-warm-accent/40 bg-warm-accent/10"
                : "border-warm-border/60 bg-warm-sunken",
            )}
          >
            <StatusDot tone={isDirty ? "accent" : "success"} pulse={isDirty} />
            <span className="font-mono text-[11px] tracking-wider text-warm-slate uppercase">
              {isDirty
                ? "Unsaved changes"
                : !showPostActions
                  ? "Profile • saved"
                  : post?.isDraft
                    ? "Draft • saved"
                    : "Live • synced"}
            </span>
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/*
           * The portfolio itself. Always offered, on every tab — the studio writes what
           * this page shows, and there is otherwise no way from here to go and look at it.
           *
           * The signed-in account's own page, not "/": every account is its own tenant, and
           * "/" is the site owner's portfolio, which for anyone else is somebody else's.
           */}
          <a
            href={session?.authorHandle ? `/${session.authorHandle}` : "/"}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded border border-warm-border bg-warm-surface px-3 py-1.5 font-mono text-xs text-warm-black transition-colors hover:bg-warm-sunken"
          >
            <Icon name="eye" className="text-[15px]" />
            <span className="hidden sm:inline">Visit portfolio</span>
            <Icon name="arrow-outward" className="text-[15px] text-warm-slate" />
          </a>

          {showPostActions ? (
            <>
              {liveUrl ? (
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden items-center gap-1.5 px-3 py-1.5 font-mono text-xs text-warm-slate transition-colors hover:text-warm-black md:inline-flex"
                >
                  View live
                  <Icon name="arrow-outward" className="text-[15px]" />
                </a>
              ) : null}

              <Button onClick={onDiscard} disabled={!canAct || !isDirty}>
                Discard
              </Button>

              <Button
                icon="save"
                onClick={onSave}
                disabled={!canAct || !isDirty}
                busy={busy === "saving"}
              >
                {/*
                 * "Save draft" only while it is one. A PUT does not change whether a post is
                 * published, so calling it that on a live post would suggest it takes the post
                 * down, which it does not.
                 */}
                {post?.isDraft ? "Save draft" : "Save changes"}
              </Button>

              {/*
               * Blocked rather than merely discouraged: the API refuses a project with no
               * thumbnail or trailer, so the button says why on hover instead of offering a
               * click that can only fail.
               */}
              <Button
                variant="primary"
                icon="publish"
                onClick={onPublish}
                disabled={
                  !canAct ||
                  (!post?.isDraft && !isDirty) ||
                  (post?.isDraft === true && publishBlockers.length > 0)
                }
                title={
                  post?.isDraft && publishBlockers.length > 0
                    ? `Needs ${publishBlockers.join(" and ")} first`
                    : undefined
                }
                busy={busy === "publishing"}
              >
                {post?.isDraft ? "Publish" : "Publish changes"}
              </Button>
            </>
          ) : null}

          <Button variant="ghost" onClick={() => void signOut()} title="Sign out">
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
