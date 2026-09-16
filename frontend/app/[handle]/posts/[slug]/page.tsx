import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Footer } from "@/components/layout/Footer";
import { Monogram } from "@/components/ui/Monogram";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { MediaExtension } from "@/lib/api/generated";
import { apiUrl } from "@/lib/api/generated/client";
import { formatDate, getPublishedPost, toProfile } from "@/lib/portfolio";

// Per request, like the portfolio it hangs off: an edit in the studio should be readable
// here as soon as it is saved.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[handle]/posts/[slug]">): Promise<Metadata> {
  const { handle, slug } = await params;
  const found = await getPublishedPost(handle, slug);

  if (!found) return { title: "Not found" };

  return {
    title: `${found.post.title} — ${found.author.name}`,
    description: found.post.summary ?? undefined,
  };
}

/**
 * One published post, read in full: the summary the card shows, then the write-up itself.
 *
 * Only reachable under the handle of the author who wrote it — see `getPublishedPost`.
 */
export default async function PostPage({ params }: PageProps<"/[handle]/posts/[slug]">) {
  const { handle, slug } = await params;
  const found = await getPublishedPost(handle, slug);

  if (!found) notFound();

  const { author, post } = found;
  const profile = toProfile(author);
  const portfolioHref = `/${encodeURIComponent(handle)}`;

  const trailerUrl = apiUrl(post.trailer?.url);
  const thumbnailUrl = apiUrl(post.thumbnail?.url);
  const trailerIsVideo =
    post.trailer?.extension === MediaExtension.Mp4 ||
    post.trailer?.extension === MediaExtension.Webm;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-warm-border bg-warm-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6 sm:px-8">
          <Link
            href={portfolioHref}
            className="group flex shrink-0 items-center gap-2.5 text-sm font-semibold tracking-tight text-warm-black"
          >
            <Monogram className="shadow-sm transition-colors group-hover:border-warm-accent">
              {profile.monogram}
            </Monogram>
            <span className="hidden font-mono text-xs uppercase tracking-wide text-warm-slate transition-colors group-hover:text-warm-black sm:inline">
              {profile.handle}
            </span>
          </Link>

          <Link
            href={`${portfolioHref}#projects`}
            className="rounded-sm font-mono text-xs uppercase tracking-wider text-warm-slate transition-colors hover:text-warm-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-warm-accent"
          >
            ← All projects
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-6 sm:px-8">
        <main className="py-12 md:py-20">
          <article className="mx-auto max-w-3xl">
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-warm-slate">
              <span className="font-semibold uppercase tracking-wider text-warm-accent">
                Project write-up
              </span>
              {post.publishedAt ? (
                <>
                  <span aria-hidden>•</span>
                  <time dateTime={post.publishedAt.toISOString()}>
                    {formatDate(post.publishedAt)}
                  </time>
                </>
              ) : null}
            </div>

            <h1 className="mt-3 font-serif text-4xl leading-tight text-warm-black sm:text-5xl">
              {post.title}
            </h1>

            {post.summary ? (
              <p className="mt-5 text-lg leading-relaxed text-warm-slate">{post.summary}</p>
            ) : null}

            {post.repoUrl || post.demoUrl ? (
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                {post.repoUrl ? (
                  <a
                    href={post.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg bg-warm-black px-4 py-2 font-mono text-xs font-medium text-warm-bg transition-colors hover:bg-black"
                  >
                    <span>GitHub Repo</span>
                    <span aria-hidden>↗</span>
                  </a>
                ) : null}
                {post.demoUrl ? (
                  <a
                    href={post.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-warm-border bg-warm-surface px-4 py-2 font-mono text-xs text-warm-black transition-colors hover:bg-warm-hover"
                  >
                    <span>Live Playground</span>
                    <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
                  </a>
                ) : null}
              </div>
            ) : null}

            {trailerUrl ? (
              <div className="mt-10 aspect-video w-full overflow-hidden rounded-xl border border-warm-border bg-warm-sunken shadow-card">
                {trailerIsVideo ? (
                  <video
                    src={trailerUrl}
                    poster={thumbnailUrl ?? undefined}
                    controls
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    aria-label={`Trailer for ${post.title}`}
                    className="size-full object-cover"
                  />
                ) : (
                  // A signed link with a deadline; see ProjectCard for why the optimizer is
                  // bypassed.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={trailerUrl}
                    alt={`Preview of ${post.title}`}
                    className="size-full object-cover"
                  />
                )}
              </div>
            ) : null}

            <SurfaceCard className="mt-10 p-7 sm:p-10">
              <div className="prose-studio prose-article">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // Embeds copied from the studio point at the API's own media route, which
                    // is relative. Resolved against the API rather than this site.
                    img: ({ src, alt }) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={typeof src === "string" ? (apiUrl(src) ?? undefined) : undefined}
                        alt={alt ?? ""}
                        loading="lazy"
                        className="rounded-lg border border-warm-border"
                      />
                    ),
                  }}
                >
                  {post.body ?? ""}
                </ReactMarkdown>
              </div>
            </SurfaceCard>

            <div className="mt-10 flex justify-center">
              <Link
                href={`${portfolioHref}#projects`}
                className="rounded-full border border-warm-border bg-warm-surface px-6 py-2.5 font-mono text-xs tracking-wide text-warm-black shadow-sm transition-colors hover:bg-warm-hover"
              >
                ← Back to {profile.name}&rsquo;s projects
              </Link>
            </div>
          </article>
        </main>
        <Footer profile={profile} sectionBase={portfolioHref} />
      </div>
    </>
  );
}
