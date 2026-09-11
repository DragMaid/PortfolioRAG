import { cn } from "@/lib/cn";

/**
 * The mark inside a timeline node: the uploaded company logo, or the company's initials
 * when there is none.
 *
 * The logo is served from whatever host the media service redirects to, so this stays a
 * plain <img> rather than adding every possible origin to `images.remotePatterns` — the
 * same call the avatar makes.
 */
export function CompanyMark({
  company,
  logoUrl,
  className,
}: {
  company: string;
  logoUrl: string | null;
  className?: string;
}) {
  if (logoUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={logoUrl}
        alt=""
        className={cn("size-full rounded-full object-contain", className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "flex size-full items-center justify-center font-mono text-[13px] font-semibold",
        className,
      )}
    >
      {initialsOf(company)}
    </span>
  );
}

/** "Stripe" -> "S", "Acme Systems" -> "AS". At most two letters; more will not fit. */
function initialsOf(company: string): string {
  const letters = company
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() ?? "");

  if (letters.length === 0) return "?";
  return (letters[0] + (letters.length > 1 ? letters[1] : "")).slice(0, 2);
}
