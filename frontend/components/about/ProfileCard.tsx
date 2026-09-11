import { AvatarPlaceholderIcon, ContactGlyph, MailIcon, MapPinIcon } from "@/components/icons";
import { StatusDot } from "@/components/ui/StatusDot";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import type { Profile } from "@/lib/types";

function ContactRow({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="shrink-0 text-warm-accent">{icon}</span>
      <span className="truncate">{label}</span>
    </>
  );

  if (!href) {
    return <div className="flex items-center gap-2.5">{content}</div>;
  }

  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="flex items-center gap-2.5 transition-colors hover:text-warm-black"
    >
      {content}
    </a>
  );
}

/** Avatar, identity, availability and contact handles. */
export function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <SurfaceCard className="flex h-full flex-col items-start justify-between p-7 text-left sm:p-8">
      <div className="flex w-full flex-col items-start">
        <div className="relative mx-auto mb-6 size-36 shrink-0 sm:mx-0 sm:size-40">
          <div className="group flex size-full items-center justify-center overflow-hidden rounded-full border-2 border-warm-border bg-gradient-to-br from-warm-hover via-warm-bg to-warm-border/30 shadow-subtle">
            {profile.avatarUrl ? (
              /* The avatar host is whatever the media service returns, so this
                 stays a plain <img> rather than adding every possible origin to
                 `images.remotePatterns`. */
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={profile.avatarUrl}
                alt=""
                className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <AvatarPlaceholderIcon className="size-20 text-warm-slate/50 transition-transform duration-500 group-hover:scale-105" />
            )}
          </div>
          <div className="absolute bottom-2 right-1 flex items-center gap-1 rounded-full border border-warm-border bg-warm-surface/95 px-2 py-0.5 font-mono text-[9px] text-warm-black shadow-sm">
            <StatusDot className="size-1.5" />
            {profile.timezoneLabel}
          </div>
        </div>

        <h1 className="font-serif text-2xl font-normal tracking-tight text-warm-black sm:text-3xl">
          {profile.name}
        </h1>
        <p className="mt-1 font-mono text-xs text-warm-slate">{profile.title}</p>

        <div className="mt-4 flex w-full items-center gap-2.5 rounded-xl border border-warm-border/90 bg-warm-bg px-3 py-2 font-mono text-xs text-warm-black">
          <StatusDot variant="pulse" />
          <span className="text-[11px] leading-snug">{profile.availability}</span>
        </div>

        <div className="my-5 h-px w-full bg-warm-border" />

        <div className="w-full space-y-3 font-mono text-xs text-warm-slate">
          <ContactRow icon={<MapPinIcon className="size-4" />} label={profile.location} />
          <ContactRow
            icon={<MailIcon className="size-4" />}
            label={profile.email}
            href={`mailto:${profile.email}`}
          />
          {profile.contacts.map((contact) => (
            <ContactRow
              key={contact.href}
              icon={<ContactGlyph name={contact.icon} className="size-4" />}
              label={contact.label}
              href={contact.href}
            />
          ))}
        </div>
      </div>

      <div className="mt-8 flex w-full items-center justify-between gap-3 border-t border-warm-border/60 pt-4 font-mono text-[11px] text-warm-slate">
        <span>{profile.focus}</span>
        {/* The year is today's, not a stored field: a portfolio that still says 2025 in
            2027 reads as abandoned, and nobody remembers to edit it. */}
        <span className="text-warm-accent">{new Date().getFullYear()}</span>
      </div>
    </SurfaceCard>
  );
}
