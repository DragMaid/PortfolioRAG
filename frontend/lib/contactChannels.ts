import type { ContactIcon } from "@/lib/types";

/**
 * Reading a contact link: which mark goes beside it, and where it actually points.
 *
 * The API stores a label and whatever address the author typed, and nothing else — no
 * stored "kind", no scheme added on the way in. That keeps any address storable, and puts
 * both questions here, where a new service is a line in a table rather than an enum value,
 * a migration and a redeploy.
 */

/** Host to service. Matched by suffix, so "gist.github.com" and "www.github.com" both count. */
const KNOWN_HOSTS: [string, ContactIcon][] = [
  ["github.com", "GitHub"],
  ["gitlab.com", "GitLab"],
  ["linkedin.com", "LinkedIn"],
  ["x.com", "X"],
  ["twitter.com", "X"],
  ["instagram.com", "Instagram"],
  ["youtube.com", "YouTube"],
  ["youtu.be", "YouTube"],
  ["facebook.com", "Facebook"],
  ["fb.com", "Facebook"],
  ["discord.com", "Discord"],
  ["discord.gg", "Discord"],
  ["t.me", "Telegram"],
  ["telegram.me", "Telegram"],
  ["reddit.com", "Reddit"],
  ["twitch.tv", "Twitch"],
  ["dribbble.com", "Dribbble"],
  ["medium.com", "Medium"],
  ["bsky.app", "Bluesky"],
  ["mastodon.social", "Mastodon"],
  ["mastodon.online", "Mastodon"],
  ["stackoverflow.com", "StackOverflow"],
  ["threads.net", "Threads"],
  ["threads.com", "Threads"],
  ["behance.net", "Behance"],
  ["dev.to", "DevTo"],
];

/** What each service is called where the studio names one. */
export const CONTACT_SERVICE_NAMES: Record<ContactIcon, string> = {
  Website: "Website",
  Email: "Email",
  Phone: "Phone",
  GitHub: "GitHub",
  GitLab: "GitLab",
  LinkedIn: "LinkedIn",
  X: "X / Twitter",
  Instagram: "Instagram",
  YouTube: "YouTube",
  Facebook: "Facebook",
  Discord: "Discord",
  Telegram: "Telegram",
  Reddit: "Reddit",
  Twitch: "Twitch",
  Dribbble: "Dribbble",
  Medium: "Medium",
  Bluesky: "Bluesky",
  Mastodon: "Mastodon",
  StackOverflow: "Stack Overflow",
  Threads: "Threads",
  Behance: "Behance",
  DevTo: "DEV",
};

/** An "@" with no slash before it is an email address rather than a path. */
function looksLikeEmail(value: string): boolean {
  const slash = value.indexOf("/");
  const at = value.indexOf("@");
  return at > 0 && (slash < 0 || at < slash);
}

/** Digits and the punctuation phone numbers are written with, and nothing else. */
function looksLikePhone(value: string): boolean {
  return /^\+?[\d][\d\s().-]{4,}$/.test(value);
}

/**
 * Which mark to draw beside an address.
 *
 * Matched on the host, never on the whole string: "example.com/my-github-notes" is a
 * website, and a substring match would call it a GitHub profile. Anything unrecognised is
 * a website, which is never a wrong answer — an address this has never seen still renders,
 * it just gets the globe.
 */
export function detectContactIcon(url: string): ContactIcon {
  const candidate = url.trim();
  if (!candidate) return "Website";

  if (/^mailto:/i.test(candidate)) return "Email";
  if (/^tel:/i.test(candidate)) return "Phone";

  if (!candidate.includes("://")) {
    if (looksLikeEmail(candidate)) return "Email";
    if (looksLikePhone(candidate)) return "Phone";
  }

  let host: string;
  try {
    host = new URL(candidate.includes("://") ? candidate : `https://${candidate}`).hostname.toLowerCase();
  } catch {
    return "Website";
  }

  for (const [knownHost, icon] of KNOWN_HOSTS) {
    if (host === knownHost || host.endsWith(`.${knownHost}`)) return icon;
  }

  // NOTE: Mastodon is federated, so there is no one host to match. Instances are named
  // after it often enough that this catches most, and the rest are websites.
  if (host.includes("mastodon")) return "Mastodon";

  return "Website";
}

/**
 * The address as an anchor should carry it.
 *
 * A stored "github.com/avance" has no scheme, and a browser resolves that against the
 * portfolio's own origin — the link would point at /github.com/avance and 404. The scheme
 * is added here rather than on the way into the database, so what the author typed is what
 * the studio shows them next time.
 */
export function contactHref(url: string): string {
  const candidate = url.trim();
  if (!candidate) return "";

  // Any scheme at all is left alone, including ones nothing here recognises.
  if (/^[a-z][a-z\d+.-]*:/i.test(candidate)) return candidate;

  if (looksLikeEmail(candidate)) return `mailto:${candidate}`;
  if (looksLikePhone(candidate)) return `tel:${candidate.replace(/[\s().-]/g, "")}`;

  return `https://${candidate}`;
}

/**
 * The display text an address suggests — "github.com/avance" from
 * "https://github.com/avance?tab=repositories". Only ever a starting point: the author can
 * write whatever they want in the label field.
 */
export function suggestChannelLabel(url: string): string {
  const candidate = url.trim();
  if (!candidate) return "";

  if (/^mailto:/i.test(candidate)) return candidate.slice("mailto:".length);
  if (/^tel:/i.test(candidate)) return candidate.slice("tel:".length);
  if (!candidate.includes("://") && (looksLikeEmail(candidate) || looksLikePhone(candidate))) {
    return candidate;
  }

  try {
    const parsed = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return candidate;
  }
}
