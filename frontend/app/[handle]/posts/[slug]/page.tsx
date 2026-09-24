import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRightIcon, ChevronLeftIcon, GitHubIcon, GlobeIcon } from "@/components/icons";
import { Footer } from "@/components/layout/Footer";
import { Markdown } from "@/components/markdown/Markdown";
import { Monogram } from "@/components/ui/Monogram";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
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

  const focusRing =
    "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-warm-accent";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-warm-border bg-warm-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6 sm:px-8">
          <Link
            href={portfolioHref}
            className={`group flex shrink-0 items-center gap-2.5 text-sm font-semibold tracking-tight text-warm-black ${focusRing}`}
          >
            <Monogram className="shadow-sm transition-colors group-hover:border-warm-accent">
              {profile.monogram}
            </Monogram>
            <span className="hidden font-mono text-xs uppercase tracking-wide text-warm-slate transition-colors group-hover:text-warm-black sm:inline">
              {profile.handle}
            </span>
          </Link>

          <div className="flex items-center gap-3 sm:gap-5">
            <Link
              href={`${portfolioHref}#projects`}
              className={`group flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-warm-slate transition-colors hover:text-warm-black ${focusRing}`}
            >
              <ChevronLeftIcon className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
              All projects
            </Link>
            <ThemeToggle className="-mr-1.5 text-warm-slate hover:bg-warm-hover hover:text-warm-black" />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-6 sm:px-8">
        <main className="py-14 md:py-24">
          <article className="mx-auto max-w-3xl selection:bg-warm-raised selection:text-warm-black">
            <h1 className="text-balance font-serif text-4xl leading-[1.1] tracking-tight text-warm-black sm:text-5xl md:text-6xl">
              {post.title}
            </h1>

            {post.summary ? (
              <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-warm-slate sm:text-xl">
                {post.summary}
              </p>
            ) : null}

            {/* Byline: when, and where the work lives. Links, not buttons — the write-up is
                the point of the page, the repository is a footnote to it. */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-y border-warm-hairline py-3.5 font-mono text-xs text-warm-slate">
              {post.publishedAt ? (
                <time dateTime={post.publishedAt.toISOString()}>
                  {formatDate(post.publishedAt)}
                </time>
              ) : (
                <span>{profile.name}</span>
              )}

              {post.repoUrl || post.demoUrl ? (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  {post.repoUrl ? (
                    <a
                      href={post.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group flex items-center gap-1.5 text-warm-black transition-colors hover:text-warm-accent-ink ${focusRing}`}
                    >
                      <GitHubIcon className="size-3.5" />
                      <span className="underline decoration-warm-border underline-offset-4 transition-colors group-hover:decoration-warm-accent">
                        Source
                      </span>
                      <ArrowUpRightIcon className="size-3 text-warm-slate transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
                    </a>
                  ) : null}
                  {post.demoUrl ? (
                    <a
                      href={post.demoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group flex items-center gap-1.5 text-warm-black transition-colors hover:text-warm-accent-ink ${focusRing}`}
                    >
                      <GlobeIcon className="size-3.5" />
                      <span className="underline decoration-warm-border underline-offset-4 transition-colors group-hover:decoration-warm-accent">
                        Live demo
                      </span>
                      <ArrowUpRightIcon className="size-3 text-warm-slate transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>

            {trailerUrl ? (
              <figure className="mt-10 aspect-video w-full overflow-hidden rounded-xl border border-warm-border bg-warm-sunken shadow-card">
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
              </figure>
            ) : null}

            <div className="prose-studio prose-article mt-12 md:mt-14">
              <Markdown
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
              </Markdown>
            </div>

            <nav
              aria-label="Post"
              className="mt-16 flex items-center border-t border-warm-hairline pt-6"
            >
              <Link
                href={`${portfolioHref}#projects`}
                className={`group flex items-center gap-1.5 font-mono text-xs text-warm-slate transition-colors hover:text-warm-black ${focusRing}`}
              >
                <ChevronLeftIcon className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
                More projects by {profile.name}
              </Link>
            </nav>
          </article>
        </main>
        <Footer profile={profile} sectionBase={portfolioHref} />
      </div>
    </>
  );
}
