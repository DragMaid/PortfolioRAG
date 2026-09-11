import { StatusDot } from "@/components/ui/StatusDot";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import type { Profile } from "@/lib/types";

/** "Initiate a conversation" panel above the footer columns. */
export function ContactCallout({ profile }: { profile: Profile }) {
  const linkedin = profile.contacts.find((contact) => contact.icon === "LinkedIn");

  return (
    <SurfaceCard className="mb-16 flex flex-col items-start justify-between gap-8 p-8 sm:p-12 md:flex-row md:items-center">
      <div className="max-w-xl space-y-3">
        <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-warm-accent">
          <StatusDot variant="pulse" />
          Let&apos;s collaborate
        </div>
        <h2 className="font-serif text-3xl text-warm-black sm:text-4xl">
          Initiate a conversation
        </h2>
        <p className="text-sm leading-relaxed text-warm-slate">{profile.contactPitch}</p>
      </div>

      <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center md:w-auto">
        <a
          href={`mailto:${profile.email}`}
          className="flex items-center justify-center gap-2 rounded-xl bg-warm-black px-6 py-3.5 text-center font-mono text-xs font-medium text-warm-bg shadow-sm transition-colors hover:bg-black"
        >
          <span>{profile.email}</span>
          <span aria-hidden>↗</span>
        </a>
        {linkedin ? (
          <a
            href={linkedin.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-warm-border bg-warm-surface px-5 py-3.5 text-center font-mono text-xs text-warm-black transition-colors hover:bg-warm-hover"
          >
            LinkedIn Profile
          </a>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
