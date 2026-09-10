"use client";

import { useEffect, useState } from "react";
import { useStudio } from "@/lib/admin/useStudio";
import { AnalyticsPanel } from "./analytics/AnalyticsPanel";
import { ContentPanel } from "./content/ContentPanel";
import { TabNav, type StudioTab } from "./TabNav";
import { TopBar } from "./TopBar";

/**
 * The signed-in studio: the system bar, the two tabs, and whichever one is open.
 *
 * Follows the prototype's structure and palette. Two things it does not follow: the
 * prototype set Manrope as the sans face, and this uses the Inter the rest of the site is
 * already built on rather than loading a second family for one route; and the prototype's
 * third tab, a site-wide asset registry, is gone — the API scopes every file to a post, so
 * those live in the editor, which is where the prototype's own later revision put them.
 */
// TODO(review): the two deviations above.
export function Studio() {
  const studio = useStudio();
  const [tab, setTab] = useState<StudioTab>("content");

  useUnsavedChangesPrompt(studio.isDirty);

  return (
    <>
      <TopBar
        post={studio.baseline}
        isDirty={studio.isDirty}
        busy={studio.busy}
        onSave={() => void studio.save()}
        onPublish={() => void studio.publish()}
        onDiscard={studio.discard}
      />

      <TabNav active={tab} onChange={setTab} />

      <main className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6">
        {/*
         * Both panels stay mounted and the inactive one is hidden, matching the prototype:
         * switching tabs must not throw away an in-progress edit or re-fetch the analytics
         * window every time somebody glances at the editor.
         */}
        <div hidden={tab !== "content"}>
          <ContentPanel studio={studio} onOpenAnalytics={() => setTab("analytics")} />
        </div>

        <div hidden={tab !== "analytics"}>
          <AnalyticsPanel />
        </div>
      </main>
    </>
  );
}

/**
 * Warns before a reload or a close while an edit is unsaved.
 *
 * Nothing in the studio autosaves, so a stray Cmd-R after twenty minutes of writing would
 * take the lot with it. The browser decides the wording; all a page can do is ask.
 */
function useUnsavedChangesPrompt(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);
}
