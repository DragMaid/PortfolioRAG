import { cache } from "react";
import { apiUrl, authorsApi, postsApi } from "@/lib/api/generated/client";
import { profilePlaceholder } from "@/lib/data/profile";
import type { Profile } from "@/lib/types";
import type { AuthorDto, PostDto, PostSummaryDto } from "@/lib/api/generated";
import { PostSortOrder } from "@/lib/api/generated";

// TODO: set the authorId by signing in
const authorId = null;

export async function getOwner(): Promise<AuthorDto | null> {
  try {
    if (authorId !== null) return await authorsApi.authorsGetById({ id: authorId });

    const authors = await authorsApi.authorsGetAll();
    return authors[0] ?? null;
  } catch {
    return null;
  }
}

// Initials from a display name, e.g. "Alexander Vance" -> "AV".
function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "");
  if (letters.length === 0) return profilePlaceholder.monogram;
  return (letters[0] + (letters.at(-1) ?? "")).slice(0, 2);
}

/** Splits a stored biography into paragraphs on blank lines. */
function toParagraphs(biography: string): string[] {
  const paragraphs = biography
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return paragraphs.length > 0 ? paragraphs : profilePlaceholder.biography;
}

export const getProfile = cache(async (): Promise<Profile> => {
  const author = await getOwner();
  if (!author) return profilePlaceholder;

  const name = author.name?.trim() || profilePlaceholder.name;

  return {
    ...profilePlaceholder,
    name,
    monogram: initialsOf(name),
    email: author.email?.trim() || profilePlaceholder.email,
    avatarUrl: apiUrl(author.avatarUrl) ?? profilePlaceholder.avatarUrl,
    biography: author.biography?.trim()
      ? toParagraphs(author.biography)
      : profilePlaceholder.biography,
  };
});

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
