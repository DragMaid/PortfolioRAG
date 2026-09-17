"use client";

import { useEffect, useState } from "react";
import { useProfile } from "@/lib/admin/useProfile";
import { useStudio } from "@/lib/admin/useStudio";
import { AccessPanel } from "./access/AccessPanel";
import { AnalyticsPanel } from "./analytics/AnalyticsPanel";
import { ContentPanel } from "./content/ContentPanel";
import { IntelligencePanel } from "./intelligence/IntelligencePanel";
import { ProfilePanel } from "./profile/ProfilePanel";
import { TabNav, type StudioTab } from "./TabNav";
import { TopBar } from "./TopBar";

/**
 * The signed-in studio: the system bar, the five tabs, and whichever one is open.
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
  const profile = useProfile();
  const [tab, setTab] = useState<StudioTab>("content");

  // Either tab can hold unsaved work, and the browser only asks once.
  useUnsavedChangesPrompt(studio.isDirty || profile.isDirty);

  return (
    <>
      <TopBar
        post={studio.baseline}
        isDirty={tab === "content" ? studio.isDirty : tab === "profile" ? profile.isDirty : false}
        busy={studio.busy}
        showPostActions={tab === "content"}
        selfSavingLabel={SELF_SAVING_LABELS[tab] ?? "Saved"}
        publishBlockers={studio.publishBlockers}
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

        <div hidden={tab !== "profile"}>
          <ProfilePanel profile={profile} />
        </div>

        {/*
         * Unlike the other three, this one is unmounted while it is closed, so it owns its
         * own hook rather than being handed one. Two reasons: it holds the only copy of a
         * freshly minted secret in state, and a secret left sitting behind a hidden div is
         * one nobody decided to dismiss; and its list is worth fetching when somebody opens
         * the tab rather than for every visit to the editor.
         */}
        {tab === "access" ? <AccessPanel /> : null}

        {/*
         * Unmounted while closed, like the access tab and for one of the same two reasons:
         * its list is worth fetching when somebody opens the tab rather than on every visit
         * to the editor. It holds no secret of its own — the provider key is write-only —
         * but it does poll a running job, and a poller left behind a hidden div is one
         * nobody decided to keep running.
         */}
        {tab === "intelligence" ? <IntelligencePanel /> : null}
      </main>
    </>
  );
}

/** What the status pill says on a tab that writes straight through and so is never dirty. */
const SELF_SAVING_LABELS: Partial<Record<StudioTab, string>> = {
  profile: "Profile • saved",
  access: "Access • saved",
  intelligence: "Intelligence • saved",
};

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
