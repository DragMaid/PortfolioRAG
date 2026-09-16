"use client";

import { useIntelligence } from "@/lib/admin/useIntelligence";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Panel } from "../ui/Panel";
import { CoverLetterCard } from "./CoverLetterCard";
import { ExposureCard } from "./ExposureCard";
import { IndexCard } from "./IndexCard";
import { KeyCard } from "./KeyCard";
import { TrialRun } from "./TrialRun";

/**
 * The fifth tab: the model that answers questions about this portfolio.
 *
 * Ordered as the decision is actually made — supply a key, see what it built, try it
 * yourself, then decide whether strangers get it. The public toggle is last deliberately:
 * it is the one irreversible-feeling act on the screen, and nobody should reach it before
 * they have seen what it will show.
 */
export function IntelligencePanel() {
  const intelligence = useIntelligence();

  if (intelligence.state === "loading") return <IntelligenceSkeleton />;

  if (intelligence.state === "error") {
    return (
      <Panel className="p-6">
        <EmptyState
          icon="error"
          title="Could not load your provider key"
          description="The API did not answer. Nothing has been changed."
          action={<Button onClick={() => void intelligence.reload()}>Try again</Button>}
        />
      </Panel>
    );
  }

  const { credential, draft } = intelligence;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-warm-border/60 pb-2">
        <div>
          <h1 className="font-serif text-2xl font-medium text-warm-black sm:text-3xl">
            Intelligence
          </h1>
          <p className="mt-0.5 max-w-2xl text-[13.5px] text-warm-slate">
            Add your own model provider key and your portfolio can answer a question about
            itself: given this job description, which requirements does the published work
            actually evidence? It can also draft you a cover letter for a posting. Everything
            is drawn from your posts, timeline and profile, and the index behind it is kept up
            to date for you.
          </p>
        </div>
      </header>

      <KeyCard
        credential={credential}
        providers={intelligence.providers}
        busy={intelligence.busy}
        onSave={intelligence.saveKey}
        onRevalidate={() => void intelligence.revalidate()}
        onRemove={() => void intelligence.remove()}
      />

      {credential && draft ? (
        <>
          <IndexCard credential={credential} />

          <TrialRun
            busy={intelligence.busy}
            isWorking={intelligence.isWorking}
            trial={intelligence.trial}
            error={intelligence.trialError}
            onRun={(text) => void intelligence.tryJobFit(text)}
            onClear={intelligence.clearTrial}
          />

          <CoverLetterCard onFinished={intelligence.refresh} />

          <ExposureCard
            credential={credential}
            draft={draft}
            busy={intelligence.busy}
            isDirty={intelligence.isDirty}
            onChange={intelligence.update}
            onSave={() => void intelligence.saveExposure()}
          />
        </>
      ) : (
        <Panel className="flex flex-col gap-3 p-5 sm:p-6">
          <h2 className="font-mono text-xs font-semibold tracking-wider text-warm-black uppercase">
            What happens when you add one
          </h2>
          <ol className="flex flex-col gap-2 text-[12.5px] leading-relaxed text-warm-slate">
            <Step n={1}>
              The key is checked with the provider, then sealed and stored. It is never
              shown again, never logged, and an API token cannot reach it however wide its
              scope.
            </Step>
            <Step n={2}>
              Your published work is cut into passages and indexed for search, and re-indexed
              automatically whenever you publish or edit. That runs on our own hardware and
              costs nothing.
            </Step>
            <Step n={3}>
              You can run a posting against it yourself and read exactly what a visitor
              would see, before deciding whether any visitor sees it at all.
            </Step>
            <Step n={4}>
              If you turn it on, a per-visitor daily limit, a monthly count and a spending
              ceiling all apply. The feature switches itself off at the ceiling rather than
              continuing to spend.
            </Step>
          </ol>
        </Panel>
      )}
    </section>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-px font-mono text-[11px] text-warm-accent tabular-nums">
        {String(n).padStart(2, "0")}
      </span>
      <span>{children}</span>
    </li>
  );
}

function IntelligenceSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="h-10 w-1/3 rounded bg-warm-sunken" />
      <div className="h-52 rounded bg-warm-sunken" />
      <div className="h-40 rounded bg-warm-sunken" />
    </div>
  );
}
