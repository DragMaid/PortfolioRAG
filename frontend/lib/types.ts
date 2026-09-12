/**
 * View-model types for the portfolio landing page.
 *
 * Components take these as props and hold no data of their own, so what the loader in
 * `lib/portfolio.ts` reads — the API, or the fallback copy in `lib/data/` when it cannot
 * be reached — is a change of loader, not a change of markup.
 */

/**
 * Which mark is drawn beside a contact link.
 *
 * Purely a display concern, and so defined here rather than on the API: a channel is
 * stored as a label and an address, and `detectContactIcon()` in `lib/contactChannels.ts`
 * reads one of these off the address when it is rendered. Adding a service is a line in
 * that file and a glyph in `components/icons` — no migration, and no address becomes
 * unstorable in the meantime.
 */
export type ContactIcon =
  | "Website"
  | "Email"
  | "Phone"
  | "GitHub"
  | "GitLab"
  | "LinkedIn"
  | "X"
  | "Instagram"
  | "YouTube"
  | "Facebook"
  | "Discord"
  | "Telegram"
  | "Reddit"
  | "Twitch"
  | "Dribbble"
  | "Medium"
  | "Bluesky"
  | "Mastodon"
  | "StackOverflow"
  | "Threads"
  | "Behance"
  | "DevTo";

export type ContactLink = {
  /** Display text, e.g. "github.com/avance". */
  label: string;
  /** The stored address, resolved to something an anchor can carry. */
  href: string;
  icon: ContactIcon;
  /** Shown in the footer's network column when it differs from `label`. */
  footerLabel?: string;
};

export type Profile = {
  name: string;
  /** Sub-title under the name, e.g. "Staff Systems & Distributed Infrastructure". */
  title: string;
  /** Two-letter mark used by the nav and footer badges. Derived from `name`. */
  monogram: string;
  /** Lowercase nav handle, e.g. "alexander.vance / dev". Derived from `name`. */
  handle: string;
  avatarUrl: string | null;
  /** Large serif statement at the top of the biography card. */
  headline: string;
  /** Long-form self-description, in Markdown. */
  biography: string;
  email: string;
  location: string;
  /** Availability line beside the pulsing status dot, in the card and the footer. */
  availability: string;
  /** Bottom-left note on the profile card, e.g. "Primary focus: Systems / C++ / Rust". */
  focus: string;
  contacts: ContactLink[];
  /** Short paragraph in the footer's first column. */
  footerBio: string;
  /** Copy for the "Initiate a conversation" call-out. */
  contactPitch: string;
  colophon: string;
};

export type ExperienceEntry = {
  id: string;
  company: string;
  /** Uploaded company mark, or null — the timeline then draws a lettermark. */
  logoUrl: string | null;
  role: string;
  /** Team or org line under the role. Empty when the author did not give one. */
  team: string;
  /** Short range printed on the timeline node, e.g. "2019 — 2021". */
  period: string;
  /** Caption under the node — the team, or the company when there is no team. */
  caption: string;
  /** Full range with tenure, e.g. "May 2019 — Sep 2021 (2.4 yrs)". */
  duration: string;
  /** Compact label for the mobile selector, e.g. "Stripe ('19)". */
  shortLabel: string;
  /** What the author did there, in Markdown. */
  description: string;
};

/** A project's trailer: a short video, or a still when there is no footage. */
export type ProjectTrailer = {
  /** The API's own content route, which redirects to a link that expires. */
  url: string;
  isVideo: boolean;
};

export type Project = {
  /** Zero-padded ordinal, e.g. "01". Position in the list, not anything stored. */
  index: string;
  /** Public slug, used as a stable React key and for the reader-facing link. */
  slug: string;
  /** Category shown beside the ordinal, e.g. "VECTOR CORE". Empty when unset. */
  category: string;
  title: string;
  /** The author's pitch. Drawn in full on the banner and clamped on the card. */
  summary: string;
  /** Domain label in the card footer, e.g. "Vector Storage". Empty when unset. */
  domain: string;
  /** Publication year, or "" while the project is unpublished. */
  year: string;
  /** The card image. Required of every published project, so never null here. */
  thumbnailUrl: string;
  /** The preview reel. Required of every published project, so never null here. */
  trailer: ProjectTrailer;
  links: { repo: string | null; demo: string | null; spec: string | null };
};
