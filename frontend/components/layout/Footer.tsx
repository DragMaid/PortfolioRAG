import { ContactCallout } from "@/components/layout/ContactCallout";
import { navItems } from "@/components/layout/navigation";
import { Monogram } from "@/components/ui/Monogram";
import { StatusDot } from "@/components/ui/StatusDot";
import type { Profile } from "@/lib/types";

function FooterColumn({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-warm-black">
        {title}
      </div>
      {children}
    </div>
  );
}

/**
 * Contact call-out, link columns and colophon.
 *
 * Three columns rather than the four this started with: the fourth listed hand-written
 * "selected repos", and once the profile came from the API there was no field behind them
 * and no studio screen to write them in. A repository worth listing is a contact channel.
 */
export function Footer({ profile }: { profile: Profile }) {
  const year = new Date().getFullYear();

  return (
    <footer id="contact" className="scroll-mt-24 border-t border-warm-border pb-12 pt-16">
      <ContactCallout profile={profile} />

      <div className="grid grid-cols-1 gap-10 border-b border-warm-border pb-12 md:grid-cols-12">
        <div className="space-y-4 md:col-span-4">
          <div className="flex items-center gap-2.5">
            <Monogram className="font-bold">{profile.monogram}</Monogram>
            <span className="font-serif text-lg font-medium tracking-tight text-warm-black">
              {profile.name}
            </span>
          </div>
          <p className="max-w-sm text-xs leading-relaxed text-warm-slate">
            {profile.footerBio}
          </p>
          <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-warm-accent">
            <StatusDot variant="muted" />
            <span>{profile.availability}</span>
          </div>
        </div>

        <FooterColumn title="Navigation" className="md:col-span-3">
          <ul className="space-y-2 font-mono text-xs text-warm-slate">
            {navItems.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="transition-colors hover:text-warm-black">
                  {item.indexed}
                </a>
              </li>
            ))}
          </ul>
        </FooterColumn>

        <FooterColumn title="Network &amp; Sync" className="md:col-span-5">
          <div className="flex flex-col space-y-2 font-mono text-xs text-warm-slate">
            {profile.contacts.map((contact) => (
              <a
                key={contact.href}
                href={contact.href}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-warm-black"
              >
                {contact.footerLabel ?? contact.label}
              </a>
            ))}
            <a
              href={`mailto:${profile.email}`}
              className="transition-colors hover:text-warm-black"
            >
              {profile.email}
            </a>
          </div>
        </FooterColumn>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 pt-6 font-mono text-xs text-warm-slate sm:flex-row">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span>{profile.name}</span>
          <span aria-hidden>•</span>
          <span>{profile.location}</span>
          <span aria-hidden>•</span>
          <span className="text-warm-accent">{profile.timezone}</span>
        </div>
        <div className="text-center sm:text-right">
          <span>
            {profile.colophon} © {year}.
          </span>
        </div>
        <a
          href="#about"
          className="group flex items-center gap-1 transition-colors hover:text-warm-black"
        >
          <span>Back to top</span>
          <span aria-hidden className="transition-transform group-hover:-translate-y-0.5">
            ↑
          </span>
        </a>
      </div>
    </footer>
  );
}
