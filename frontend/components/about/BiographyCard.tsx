import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import type { Profile } from "@/lib/types";

/**
 * Headline statement plus the biography.
 *
 * The biography is Markdown — the same `prose-studio` rules the studio previews it under,
 * so what the author sees while writing is what a reader gets.
 */
export function BiographyCard({ profile }: { profile: Profile }) {
  return (
    <SurfaceCard accentEdge className="h-full p-8 sm:p-10">
      <h2 className="font-serif text-2xl leading-snug text-warm-black sm:text-3xl">
        {profile.headline}
      </h2>
      <div className="prose-studio mt-6 text-sm sm:text-base">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{profile.biography}</ReactMarkdown>
      </div>
    </SurfaceCard>
  );
}
