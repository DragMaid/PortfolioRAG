import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowDownIcon } from "@/components/icons";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import type { Profile } from "@/lib/types";

/**
 * Headline statement plus the biography.
 *
 * The biography is Markdown — the same `prose-studio` rules the studio previews it under,
 * so what the author sees while writing is what a reader gets.
 */
export function BiographyCard({
  profile,
  showJobFitCta = false,
}: {
  profile: Profile;
  /** Whether the job-fit section is on the page for the invitation to point at. */
  showJobFitCta?: boolean;
}) {
  return (
    <SurfaceCard accentEdge className="flex h-full flex-col p-8 sm:p-10 rounded-sm">
      <h2 className="animate-ink-in-late max-w-[28ch] font-serif text-[1.75rem] leading-[1.2] tracking-tight text-balance text-warm-black sm:text-[2.25rem]">
        {profile.headline}
      </h2>
      <div className="animate-settle-in prose-studio prose-article mt-6 max-w-prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {profile.biography}
        </ReactMarkdown>
      </div>

      {/*
       * The invitation closes the biography rather than sitting in the identity card: a
       * visitor meets it after reading who this is, and it asks as a quiet row instead of
       * the heaviest block on the page.
       */}
      {showJobFitCta ? (
        <div className="animate-settle-in-last mt-auto pt-10">
          <div aria-hidden className="animate-rule-draw h-px bg-warm-hairline" />
          <div className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
            <p className="max-w-md text-sm leading-relaxed text-pretty text-warm-slate">
              <span className="text-warm-black">Hiring?</span> Paste a job
              description and see which requirements the published work here
              actually backs up.
            </p>
            <a
              href="#job-fit"
              className="group inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-warm-border bg-warm-bg px-4 py-2.5 text-sm font-medium text-warm-black transition-colors hover:border-warm-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-accent sm:self-auto"
            >
              Check your role against my work
              <ArrowDownIcon className="size-4 text-warm-accent-ink transition-transform duration-200 ease-out group-hover:translate-y-0.5" />
            </a>
          </div>
        </div>
      ) : null}
    </SurfaceCard>
  );
}
