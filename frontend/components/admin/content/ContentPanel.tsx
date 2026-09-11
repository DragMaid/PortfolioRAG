"use client";

import type { useStudio } from "@/lib/admin/useStudio";
import { DossierEditor } from "./DossierEditor";
import { ProjectRegistry } from "./ProjectRegistry";
import { RegistrySummary } from "./RegistrySummary";

/** The first tab: the registry on the left, the open project on the right. */
export function ContentPanel({
  studio,
  onOpenAnalytics,
}: {
  studio: ReturnType<typeof useStudio>;
  onOpenAnalytics: () => void;
}) {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-warm-border/60 pb-2">
        <div>
          <h1 className="font-serif text-2xl font-medium text-warm-black sm:text-3xl">
            Projects & editor
          </h1>
          <p className="mt-0.5 text-[13.5px] text-warm-slate">
            Write and publish the projects the portfolio lists, and manage the files each one embeds.
          </p>
        </div>

        {studio.baseline ? (
          <div className="flex items-center gap-2 font-mono text-[11px] text-warm-slate">
            <span>Open:</span>
            <span className="rounded border border-warm-border bg-warm-surface px-2 py-0.5 font-medium text-warm-black">
              #{studio.baseline.id} / {studio.baseline.slug}
            </span>
          </div>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-4">
          <ProjectRegistry
            posts={studio.visiblePosts}
            counts={studio.counts}
            filter={studio.filter}
            onFilterChange={studio.setFilter}
            activeId={studio.activeId}
            onSelect={(id) => void studio.openPost(id)}
            onCreate={() => void studio.createPost()}
            creating={studio.busy === "creating"}
            state={studio.listState}
            onRetry={() => void studio.reloadPosts()}
          />

          <RegistrySummary onOpenAnalytics={onOpenAnalytics} />
        </div>

        <div className="lg:col-span-8">
          <DossierEditor
            post={studio.baseline}
            draft={studio.draft}
            media={studio.attachments}
            thumbnail={studio.thumbnail}
            trailer={studio.trailer}
            publishBlockers={studio.publishBlockers}
            state={studio.editorState}
            busy={studio.busy}
            onChange={studio.updateDraft}
            onUnpublish={() => void studio.unpublish()}
            onDelete={() => void studio.deletePost()}
            onUpload={studio.uploadMedia}
            onCaptionChange={studio.updateMediaCaption}
            onDeleteMedia={studio.deleteMedia}
            onCreate={() => void studio.createPost()}
          />
        </div>
      </div>
    </section>
  );
}
