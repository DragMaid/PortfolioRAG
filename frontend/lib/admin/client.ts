"use client";

import {
  AdminAnalyticsApi,
  AdminPostsApi,
  AuthApi,
  AuthorsApi,
  Configuration,
  ContactChannelsApi,
  ExperiencesApi,
  FetchError,
  PostMediaApi,
  ResponseError,
} from "@/lib/api/generated";
import { API_BASE_URL } from "@/lib/api/generated/client";
import { clearSession, getAccessToken } from "./session";

// Separated client with authorization to avoid bearer token coupling
const configuration = new Configuration({
  basePath: API_BASE_URL,

  // Called per request, so a token refreshed halfway through a session is picked up without rebuilding the client
  accessToken: async () => (await getAccessToken()) ?? "",

  middleware: [
    {
      async post({ response }) {
        if (response.status === 401) clearSession();
      },
    },
  ],
});

export const adminPostsApi = new AdminPostsApi(configuration);
export const postMediaApi = new PostMediaApi(configuration);
export const adminAnalyticsApi = new AdminAnalyticsApi(configuration);
export const authorsApi = new AuthorsApi(configuration);
export const experiencesApi = new ExperiencesApi(configuration);
export const contactChannelsApi = new ContactChannelsApi(configuration);
export const authApi = new AuthApi(new Configuration({ basePath: API_BASE_URL }));

/*
 * The same endpoints, signed. Sign-in, registration and refresh must not carry a bearer
 * token — a session is what they produce — but everything under /api/auth/tokens acts on
 * the signed-in account, and the API refuses all of it without one.
 */
export const authAccountApi = new AuthApi(configuration);

// Format the erorr into something more user-friendly
export async function describeError(error: unknown, fallback: string): Promise<string> {
  if (error instanceof ResponseError) {
    try {
      // Because response body is a stream, passing it without clone would consume the whole stream
      const problem = await error.response.clone().json();

      // Adding the fallback as the latest error record, no need to trace back the stack
      const validation = problem?.errors as Record<string, string[]> | undefined;

      // Object.values() -> return a list of values in dict -> flat([[]]) -> []
      if (validation) {
        const first = Object.values(validation).flat()[0];
        if (first) return first;
      }

      if (typeof problem?.detail === "string" && problem.detail) return problem.detail;
      if (typeof problem?.title === "string" && problem.title) return problem.title;
    } catch {
      // Not problem+json. Fall through to the status line.
    }

    return `${fallback} (${error.response.status})`;
  }

  if (error instanceof FetchError) {
    return `Could not reach the API at ${API_BASE_URL}. It may be down, or this origin may not be in its CORS allowlist.`;
  }

  if (error instanceof Error && error.message) return error.message;

  return fallback;
}
