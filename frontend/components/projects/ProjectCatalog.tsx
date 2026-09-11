import { SurfaceCard } from "@/components/ui/SurfaceCard";
import type { Project } from "@/lib/types";

/** Full catalog grid revealed by the "Expand All Projects" toggle. */
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
        <SurfaceCard key={project.slug} className="space-y-3 p-6">
          <div className="flex justify-between gap-3 font-mono text-xs text-warm-slate">
            <span>
              {project.category ? `${project.index} / ${project.category}` : project.index}
            </span>
            <span>{project.year}</span>
          </div>
          <h3 className="font-serif text-xl text-warm-black">{project.title}</h3>
          {project.summary ? (
            <p className="text-xs leading-relaxed text-warm-slate">{project.summary}</p>
          ) : null}
          {project.domain ? (
            <div className="border-t border-warm-border pt-3 font-mono text-[11px] text-warm-slate">
              {project.domain}
            </div>
          ) : null}
        </SurfaceCard>
      ))}
    </div>
  );
}
