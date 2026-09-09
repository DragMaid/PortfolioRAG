import { AuthorsApi, Configuration, PostsApi } from "./index";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5009"
).replace(/\/+$/, "");

const configuration = new Configuration({ basePath: API_BASE_URL });

export const authorsApi = new AuthorsApi(configuration);
export const postsApi = new PostsApi(configuration);

// If path doesnt start with https:// then replace with API_BASE_URL as prefix
export function apiUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return /^https?:\/\//.test(path) ? path : `${API_BASE_URL}${path}`;
}
