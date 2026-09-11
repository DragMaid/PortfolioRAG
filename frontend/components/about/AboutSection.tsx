import { BiographyCard } from "@/components/about/BiographyCard";
import { ProfileCard } from "@/components/about/ProfileCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Profile } from "@/lib/types";

export function AboutSection({ profile }: { profile: Profile }) {
  return (
    <section id="about" className="scroll-mt-24">
      <SectionHeading eyebrow="01 / Profile Overview" fullRule className="mb-8" />
      <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <ProfileCard profile={profile} />
        </div>
        <div className="lg:col-span-8">
          <BiographyCard profile={profile} />
        </div>
      </div>
    </section>
  );
}
