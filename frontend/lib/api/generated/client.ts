import { AuthorsApi, Configuration, JobFitApi, PostsApi } from "./index";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5009"
).replace(/\/+$/, "");

const configuration = new Configuration({ basePath: API_BASE_URL });

export const authorsApi = new AuthorsApi(configuration);
export const postsApi = new PostsApi(configuration);

// Anonymous, like the two above: the public job-fit endpoints carry no credential. What
// stands in for one is the unguessable job id the submission hands back.
export const jobFitApi = new JobFitApi(configuration);

// If path doesnt start with https:// then replace with API_BASE_URL as prefix
export function apiUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return /^https?:\/\//.test(path) ? path : `${API_BASE_URL}${path}`;
}
