import type { Metadata } from "next";
import { AboutSection } from "@/components/about/AboutSection";
import { ExperienceSection } from "@/components/experience/ExperienceSection";
import { Footer } from "@/components/layout/Footer";
import { NavBar } from "@/components/layout/NavBar";
import { ProjectsSection } from "@/components/projects/ProjectsSection";
import { projectsPlaceholder } from "@/lib/data/projects";
import { getExperience, getProfile } from "@/lib/portfolio";

// Rendered per request rather than at build time, force the frontend to call the api everytime.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const profile = await getProfile();
  return {
    title: `${profile.name} — ${profile.title}`,
    description: profile.headline,
  };
}

export default async function Home() {
  // One request behind both: the profile carries its own timeline, and `getOwner()` is cached for the render pass.
  const [profile, experience] = await Promise.all([getProfile(), getExperience()]);

  return (
    <>
      <NavBar monogram={profile.monogram} handle={profile.handle} />
      <div className="mx-auto w-full max-w-6xl px-6 sm:px-8">
        <main className="space-y-24 py-12 md:space-y-32 md:py-20">
          <AboutSection profile={profile} />
          {/* Nothing to draw until the author has added a job in the studio. */}
          <ExperienceSection entries={experience} />
          {/* TODO: placeholder data — no projects endpoint on the backend. */}
          <ProjectsSection projects={projectsPlaceholder} />
        </main>
        <Footer profile={profile} />
      </div>
    </>
  );
}
