/**
 * View-model types for the portfolio landing page.
 *
 * Components take these as props and hold no data of their own, so the swap
 * from the placeholder files in `lib/data/` to real API calls is a change of
 * loader, not a change of markup.
 */

export type SocialIcon = "github" | "linkedin" | "mail" | "x" | "key";

export type SocialLink = {
  /** Display text, e.g. "github.com/avance". */
  label: string;
  href: string;
  icon: SocialIcon;
  /** Shown in the footer's network column when it differs from `label`. */
  footerLabel?: string;
};

export type Profile = {
  name: string;
  /** Sub-title under the name, e.g. "Staff Systems & Distributed Infrastructure". */
  title: string;
  /** Two-letter mark used by the nav and footer badges. */
  monogram: string;
  /** Lowercase nav handle, e.g. "alexander.vance / dev". */
  handle: string;
  avatarUrl: string | null;
  /** Large serif statement at the top of the biography card. */
  headline: string;
  /** Body paragraphs, rendered in order. */
  biography: string[];
  email: string;
  location: string;
  /** Compact badge on the avatar, e.g. "SF / PST". */
  timezoneLabel: string;
  /** Long-form timezone for the footer colophon, e.g. "UTC -8 (PST)". */
  timezone: string;
  /** Availability line beside the pulsing status dot. */
  availability: string;
  /** Footer availability line. */
  advisoryNote: string;
  /** Bottom-left note on the profile card, e.g. "Primary focus: Systems / C++ / Rust". */
  focus: string;
  year: string;
  socials: SocialLink[];
  /** Short paragraph in the footer's first column. */
  footerBio: string;
  /** Copy for the "Initiate a conversation" call-out. */
  contactPitch: string;
  /** Repository shortcuts listed in the footer. */
  repositories: { name: string; href: string }[];
  colophon: string;
};

export type CompanyLogo = "stripe" | "vercel" | "openai";

export type ExperienceEntry = {
  id: string;
  company: string;
  logo: CompanyLogo;
  role: string;
  /** Team or org line under the role. */
  team: string;
  /** Short range printed on the timeline node, e.g. "2019 — 2021". */
  period: string;
  /** Caption under the node, e.g. "Stripe Payments". */
  caption: string;
  /** Full range with tenure, e.g. "May 2019 — Sep 2021 (2.4 yrs)". */
  duration: string;
  /** Compact label for the mobile selector, e.g. "Stripe ('19)". */
  shortLabel: string;
  highlights: string[];
};

/** Bar tint for a stat tile in the project preview window. */
export type StatTone = "positive" | "accent" | "neutral";

export type ProjectStat = {
  label: string;
  value: string;
  /** Bar fill, 0-100. */
  fill: number;
  tone: StatTone;
};

export type ProjectThumbnail =
  | "vector"
  | "shader"
  | "kernel"
  | "kinetic"
  | "lsm"
  | "wire";

export type Project = {
  /** Zero-padded ordinal, e.g. "01". */
  index: string;
  /** Category shown beside the ordinal, e.g. "VECTOR CORE". */
  category: string;
  title: string;
  /** Long copy for the preview banner. */
  description: string;
  /** Condensed copy for the carousel card and catalog grid. */
  summary: string;
  /** Domain label in the card footer, e.g. "Vector Storage". */
  domain: string;
  year: string;
  /** Headline figures for the preview banner. Not technology labels. */
  metrics: { label: string; value: string }[];
  /** URL rendered in the mock browser chrome. */
  previewUrl: string;
  stats: ProjectStat[];
  thumbnail: ProjectThumbnail;
  /** Two captions along the bottom of the card thumbnail. */
  thumbnailFooter: { left: string; right: string; highlight?: boolean };
  links: { repo: string | null; demo: string | null; spec: string | null };
};
