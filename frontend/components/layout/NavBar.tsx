import { Monogram } from "@/components/ui/Monogram";
import { navItems } from "@/components/layout/navigation";

type NavBarProps = {
  monogram: string;
  handle: string;
};

/** Sticky top bar: monogram, handle and in-page anchors. */
export function NavBar({ monogram, handle }: NavBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-warm-border bg-warm-bg/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6 sm:px-8">
        <a
          href="#about"
          className="group flex shrink-0 items-center gap-2.5 text-sm font-semibold tracking-tight text-warm-black"
        >
          <Monogram className="shadow-sm transition-colors group-hover:border-warm-accent">
            {monogram}
          </Monogram>
          {/* The handle is the first thing to go when the anchors need the room. */}
          <span className="hidden font-mono text-xs uppercase tracking-wide text-warm-slate transition-colors group-hover:text-warm-black sm:inline">
            {handle}
          </span>
        </a>

        <nav
          aria-label="Sections"
          className="flex items-center gap-4 font-mono text-xs uppercase tracking-wider text-warm-slate sm:gap-7"
        >
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-sm transition-colors hover:text-warm-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-warm-accent"
            >
              <span className="sm:hidden">{item.shortLabel}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
