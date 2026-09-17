import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AboutSection } from "@/components/about/AboutSection";
import { ExperienceSection } from "@/components/experience/ExperienceSection";
import { Footer } from "@/components/layout/Footer";
import { NavBar } from "@/components/layout/NavBar";
import { JobFitSection } from "@/components/jobfit/JobFitSection";
import { ProjectsSection } from "@/components/projects/ProjectsSection";
import { Reveal } from "@/components/ui/Reveal";
import {
  getAuthorByHandle,
  getJobFitAvailability,
  getProjects,
  toExperience,
  toProfile,
} from "@/lib/portfolio";

// Rendered per request, like the owner's page: the studio writes what this shows, and an
// author who has just published should not have to wait out a cache to see it.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const author = await getAuthorByHandle(handle);

  if (!author) return { title: "Not found" };

  const profile = toProfile(author);

  return {
    title: `${profile.name} — ${profile.title}`,
    description: profile.headline,
  };
}

/**
 * Any account's portfolio, at its own handle.
 *
 * The same three sections the owner's page draws, over a different account — every one of
 * them was already scoped to one author on the API, so this is a different argument rather
 * than a different page. `/` stays the owner's.
 */
export default async function AuthorPortfolio({ params }: PageProps<"/[handle]">) {
  const { handle } = await params;
  const author = await getAuthorByHandle(handle);

  // A handle nobody has taken is a 404, not an empty portfolio.
  if (!author?.id) notFound();

  const profile = toProfile(author);
  const experience = toExperience(author);

  // In parallel: neither depends on the other, and the availability check is a round trip
  // that would otherwise sit in series behind the project list for no reason.
  const [projects, jobFit] = await Promise.all([
    getProjects(author.id, author.handle!),
    getJobFitAvailability(handle),
  ]);

  return (
    <>
      <NavBar monogram={profile.monogram} handle={profile.handle} />
      <div className="mx-auto w-full max-w-6xl px-6 sm:px-8">
        <main className="space-y-24 py-12 md:space-y-32 md:py-20">
          <AboutSection profile={profile} showJobFitCta={jobFit?.isEnabled ?? false} />
          {/* The profile has its own arrival; everything after it rises in on scroll. */}
          <Reveal>
            <ExperienceSection entries={experience} />
          </Reveal>
          <Reveal>
            <ProjectsSection projects={projects} />
          </Reveal>

          {/*
           * Only when the owner has a working key and has chosen to show it. Both facts are
           * decided on the API — see JobFitService.GetAvailabilityAsync — so there is
           * nothing here to keep in step with them.
           */}
          {jobFit?.isEnabled ? (
            <Reveal>
              <JobFitSection
                handle={author.handle!}
                name={profile.name}
                availability={jobFit}
              />
            </Reveal>
          ) : null}
        </main>
        <Reveal>
          <Footer profile={profile} />
        </Reveal>
      </div>
    </>
  );
}
