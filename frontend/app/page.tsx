import type { Metadata } from "next";
import { LandingNav } from "@/components/landing/LandingNav";
import { Hero } from "@/components/landing/Hero";
import { Roadmap } from "@/components/landing/Roadmap";
import { DeveloperCTA } from "@/components/landing/DeveloperCTA";
import { LandingFooter } from "@/components/landing/LandingFooter";

export const metadata: Metadata = {
  title: "Portfolio — The Developer & Creator Platform",
  description:
    "We handle the complex stuff so you can express yourself to the fullest. Automated OpenAPI generation, edge distribution, and RAG intelligence for modern builders.",
};

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-white text-gray-900 flex flex-col selection:bg-gray-200 selection:text-black">
      <LandingNav />
      <main className="flex-1 w-full flex flex-col">
        <Hero />
        <Roadmap />
        <DeveloperCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
