import { authorsApi, postsApi } from "@/lib/api/generated/client";
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
