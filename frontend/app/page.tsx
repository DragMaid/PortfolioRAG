import type { Metadata } from "next";
import { AboutSection } from "@/components/about/AboutSection";
import { ExperienceSection } from "@/components/experience/ExperienceSection";
import { Footer } from "@/components/layout/Footer";
import { NavBar } from "@/components/layout/NavBar";
import { ProjectsSection } from "@/components/projects/ProjectsSection";
import { experiencePlaceholder } from "@/lib/data/experience";
import { projectsPlaceholder } from "@/lib/data/projects";
import { getProfile } from "@/lib/portfolio";

export async function generateMetadata(): Promise<Metadata> {
  const profile = await getProfile();
  return {
    title: `${profile.name} — ${profile.title}`,
    description: profile.headline,
  };
}

export default async function Home() {
  const profile = await getProfile();

  return (
    <>
      <NavBar monogram={profile.monogram} handle={profile.handle} />
      <div className="mx-auto w-full max-w-6xl px-6 sm:px-8">
        <main className="space-y-24 py-12 md:space-y-32 md:py-20">
          <AboutSection profile={profile} />
          {/* TODO: placeholder data — no experience endpoint on the backend. */}
          <ExperienceSection entries={experiencePlaceholder} />
          {/* TODO: placeholder data — no projects endpoint on the backend. */}
          <ProjectsSection projects={projectsPlaceholder} />
        </main>
        <Footer profile={profile} />
      </div>
    </>
  );
}
