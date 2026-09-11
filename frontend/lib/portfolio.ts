import { cache } from "react";
import { apiUrl, authorsApi, postsApi } from "@/lib/api/generated/client";
import { contactHref, detectContactIcon } from "@/lib/contactChannels";
import { profilePlaceholder } from "@/lib/data/profile";
import type { ContactLink, ExperienceEntry, Profile, Project } from "@/lib/types";
import type {
  AuthorDto,
  ContactChannelDto,
  ExperienceDto,
  MediaDto,
  PostDto,
  PostSummaryDto,
} from "@/lib/api/generated";
import { MediaExtension, PostSortOrder } from "@/lib/api/generated";

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

/**
 * The account at a public handle — how `/{handle}` resolves to somebody's portfolio.
 *
 * Every account gets a handle when it registers, because signing up is how somebody gets a
 * portfolio of their own and a portfolio nothing can link to is not one.
 */
export const getAuthorByHandle = cache(async (handle: string): Promise<AuthorDto | null> => {
  try {
    return await authorsApi.authorsGetByHandle({ handle });
  } catch {
    return null;
  }
});

/**
 * An account's copy as the page renders it.
 *
 * Pure, and separate from {@link getProfile}, so the owner's page and any author's page at
 * `/{handle}` share one mapping rather than two that can drift.
 */
export function toProfile(author: AuthorDto | null): Profile {
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
}

/** The portfolio owner's copy. The landing page at `/` is always theirs. */
export const getProfile = cache(async (): Promise<Profile> => toProfile(await getOwner()));

/** An account's timeline, oldest first — the order the section draws it in. */
export function toExperience(author: AuthorDto | null): ExperienceEntry[] {
  return (author?.experiences ?? []).map(toExperienceEntry);
}

export const getExperience = cache(async (): Promise<ExperienceEntry[]> =>
  toExperience(await getOwner()),
);

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

/* -------------------------------------------------------------------------- */
/* Projects                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The author's published projects, newest first — the order the carousel draws them in.
 *
 * Projects are posts: the studio has always called them that, and the API scopes both to
 * one author. What makes a post a project is the thumbnail and the trailer it cannot be
 * published without, which is what the section renders.
 */
export const getProjects = cache(async (authorId?: number): Promise<Project[]> => {
  let posts: PostSummaryDto[];

  try {
    const result = await postsApi.postsGetPublished({
      authorId,
      isDraft: false,
      sort: PostSortOrder.Newest,
      pageSize: 50,
    });

    posts = result.items ?? [];
  } catch {
    // An unreachable API is an empty section, not a crash. ProjectsSection renders
    // nothing at all when it has nothing to show.
    return [];
  }

  return posts
    .map(toProject)
    .filter((project): project is Project => project !== null)
    .map((project, position) => ({
      ...project,
      // The ordinal is the position in this list, so it stays 01..0n however the
      // underlying ids happen to fall.
      index: String(position + 1).padStart(2, "0"),
    }));
});

/**
 * One published post as the section renders it, or null if it cannot be drawn.
 *
 * Publishing requires both files, so a published post is missing one only if it was put
 * in that state by something other than the API. Skipping it beats rendering a card with
 * a hole where the picture goes.
 */
function toProject(post: PostSummaryDto): Project | null {
  const thumbnailUrl = apiUrl(post.thumbnail?.url);
  const trailerUrl = apiUrl(post.trailer?.url);

  if (!thumbnailUrl || !trailerUrl || !post.slug) return null;

  return {
    index: "00",
    slug: post.slug,
    title: post.title?.trim() || "Untitled project",
    summary: post.summary?.trim() ?? "",
    category: post.category?.trim() ?? "",
    domain: post.domain?.trim() ?? "",
    year: post.publishedAt ? String(post.publishedAt.getFullYear()) : "",
    thumbnailUrl,
    trailer: { url: trailerUrl, isVideo: isVideo(post.trailer) },
    links: {
      repo: post.repoUrl?.trim() || null,
      demo: post.demoUrl?.trim() || null,
      spec: post.specUrl?.trim() || null,
    },
  };
}

/** Whether a trailer plays or is simply drawn. A still is a legitimate trailer. */
function isVideo(media: MediaDto | null | undefined): boolean {
  return media?.extension === MediaExtension.Mp4 || media?.extension === MediaExtension.Webm;
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
