import { cache } from "react";
import { apiUrl, authorsApi, postsApi } from "@/lib/api/generated/client";
import { contactHref, detectContactIcon } from "@/lib/contactChannels";
import { profilePlaceholder } from "@/lib/data/profile";
import type { ContactLink, ExperienceEntry, Profile } from "@/lib/types";
import type {
  AuthorDto,
  ContactChannelDto,
  ExperienceDto,
  PostDto,
  PostSummaryDto,
} from "@/lib/api/generated";
import { PostSortOrder } from "@/lib/api/generated";

// TODO: set the authorId by signing in
const authorId = null;

/**
 * The account the portfolio belongs to, with its timeline and contact links.
 *
 * Cached for the render pass, so the page, its metadata and the experience section share
 * one request rather than making three of it.
 */
export const getOwner = cache(async (): Promise<AuthorDto | null> => {
  try {
    if (authorId !== null) return await authorsApi.authorsGetById({ id: authorId });

    const authors = await authorsApi.authorsGetAll();
    return authors[0] ?? null;
  } catch {
    return null;
  }
});

// Initials from a display name, e.g. "Alexander Vance" -> "AV".
function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "");
  if (letters.length === 0) return profilePlaceholder.monogram;
  return (letters[0] + (letters.at(-1) ?? "")).slice(0, 2);
}

/** The nav's lowercase handle, e.g. "Alexander Vance" -> "alexander.vance / dev". */
function handleOf(name: string): string {
  const slug = name.trim().toLowerCase().split(/\s+/).filter(Boolean).join(".");
  return slug ? `${slug} / dev` : profilePlaceholder.handle;
}

/** Trimmed, or the fallback when the author has not written this field yet. */
function orFallback(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

/**
 * A stored channel as the page renders it.
 *
 * Both the mark and the link are worked out from the address here, because that is all the
 * API keeps — see `lib/contactChannels.ts`.
 */
function toContactLink(channel: ContactChannelDto): ContactLink | null {
  const url = channel.url?.trim();
  if (!url) return null;

  return {
    label: channel.label?.trim() || url,
    href: contactHref(url),
    icon: detectContactIcon(url),
    footerLabel: channel.handle?.trim() || undefined,
  };
}

export const getProfile = cache(async (): Promise<Profile> => {
  const author = await getOwner();
  if (!author) return profilePlaceholder;

  const name = orFallback(author.name, profilePlaceholder.name);

  return {
    name,
    monogram: initialsOf(name),
    handle: handleOf(name),
    email: orFallback(author.email, profilePlaceholder.email),
    avatarUrl: apiUrl(author.avatarUrl) ?? profilePlaceholder.avatarUrl,
    title: orFallback(author.title, profilePlaceholder.title),
    headline: orFallback(author.headline, profilePlaceholder.headline),
    biography: orFallback(author.biography, profilePlaceholder.biography),
    footerBio: orFallback(author.footerBio, profilePlaceholder.footerBio),
    location: orFallback(author.location, profilePlaceholder.location),
    timezoneLabel: orFallback(author.timeZoneLabel, profilePlaceholder.timezoneLabel),
    timezone: orFallback(author.timeZone, profilePlaceholder.timezone),
    availability: orFallback(author.availability, profilePlaceholder.availability),
    focus: orFallback(author.focus, profilePlaceholder.focus),
    contactPitch: orFallback(author.contactPitch, profilePlaceholder.contactPitch),

    // NOTE: no fallback. An invented contact link is one that goes nowhere, which is worse
    // than a profile card with no links under the address.
    contacts: (author.contactChannels ?? [])
      .map(toContactLink)
      .filter((link): link is ContactLink => link !== null),

    colophon: profilePlaceholder.colophon,
  };
});

/** The author's timeline, oldest first — the order the section draws it in. */
export const getExperience = cache(async (): Promise<ExperienceEntry[]> => {
  const author = await getOwner();
  return (author?.experiences ?? []).map(toExperienceEntry);
});

/* -------------------------------------------------------------------------- */
/* Experience formatting                                                      */
/* -------------------------------------------------------------------------- */

/*
 * The timeline prints a job's dates four ways. All four are derived from the two the
 * author actually entered, rather than being four more fields to keep in agreement — the
 * old placeholder data carried them separately and nothing stopped them disagreeing.
 */

function toExperienceEntry(experience: ExperienceDto): ExperienceEntry {
  const company = experience.company?.trim() || "Untitled";
  const started = experience.startedOn ?? null;
  const ended = experience.endedOn ?? null;

  return {
    id: String(experience.id ?? company),
    company,
    logoUrl: apiUrl(experience.logoUrl),
    role: experience.role?.trim() || "",
    team: experience.team?.trim() || "",
    caption: experience.team?.trim() || company,
    period: formatPeriod(started, ended),
    duration: formatDuration(started, ended),
    shortLabel: formatShortLabel(company, started),
    description: experience.description?.trim() || "",
  };
}

/** "2019 — 2021", or "2023 — Present" for the current role. */
function formatPeriod(started: Date | null, ended: Date | null): string {
  const from = started ? String(started.getFullYear()) : "";
  const to = ended ? String(ended.getFullYear()) : "Present";
  return from ? `${from} — ${to}` : to;
}

/** "May 2019 — Sep 2021 (2.4 yrs)". */
function formatDuration(started: Date | null, ended: Date | null): string {
  if (!started) return "";

  const from = formatMonth(started);
  const to = ended ? formatMonth(ended) : "Present";
  const tenure = formatTenure(started, ended ?? new Date());

  return `${from} — ${to} (${tenure})`;
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** "2.4 yrs", or months while a job is still under a year old. */
function formatTenure(started: Date, ended: Date): string {
  const months = Math.max(
    0,
    (ended.getFullYear() - started.getFullYear()) * 12 + (ended.getMonth() - started.getMonth()),
  );

  if (months < 12) return `${months} mo${months === 1 ? "" : "s"}`;

  const years = months / 12;
  return `${years.toFixed(1)} yrs`;
}

/** "Stripe ('19)" — the mobile selector, where the full range does not fit. */
function formatShortLabel(company: string, started: Date | null): string {
  if (!started) return company;
  return `${company} ('${String(started.getFullYear()).slice(-2)})`;
}

/* -------------------------------------------------------------------------- */
/* Posts                                                                      */
/* -------------------------------------------------------------------------- */

export async function getAuthor(id: number): Promise<AuthorDto | null> {
  try {
    return await authorsApi.authorsGetById({ id });
  } catch {
    return null;
  }
}

export async function getPosts(ownerId?: number): Promise<PostSummaryDto[]> {
  try {
    const result = await postsApi.postsGetPublished({
      authorId: ownerId,
      isDraft: false,
      sort: PostSortOrder.Newest,
      pageSize: 50,
    });
    return result.items ?? [];
  } catch {
    return [];
  }
}

export async function getPost(slug: string): Promise<PostDto | null> {
  try {
    return await postsApi.postsGetBySlug({ slug });
  } catch {
    return null;
  }
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
