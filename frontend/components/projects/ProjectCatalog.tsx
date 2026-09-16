import Link from "next/link";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import type { Project } from "@/lib/types";

/** Full catalog grid revealed by the "Expand All Projects" toggle. Each card opens the write-up. */
export function ProjectCatalog({
  projects,
  id,
}: {
  projects: Project[];
  id: string;
}) {
  return (
    <div
      id={id}
      className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
    >
      {projects.map((project) => (
        <Link
          key={project.slug}
          href={project.href}
          className="group rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-warm-accent"
        >
          <SurfaceCard className="h-full space-y-3 p-6 transition-colors group-hover:border-warm-black">
            <div className="flex justify-between gap-3 font-mono text-xs text-warm-slate">
              <span>{project.index}</span>
              <span>{project.year}</span>
            </div>
            <h3 className="font-serif text-xl text-warm-black">{project.title}</h3>
            {project.summary ? (
              <p className="text-xs leading-relaxed text-warm-slate">{project.summary}</p>
            ) : null}
            <div className="border-t border-warm-border pt-3 font-mono text-[11px] font-semibold text-warm-black">
              Read the write-up →
            </div>
          </SurfaceCard>
        </Link>
      ))}
    </div>
  );
}
