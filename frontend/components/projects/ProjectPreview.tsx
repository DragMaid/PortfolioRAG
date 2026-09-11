import { PreviewWindow } from "@/components/projects/PreviewWindow";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import type { Project } from "@/lib/types";

type ProjectPreviewProps = {
  project: Project;
  panelId: string;
  /** Id of the card currently driving this panel. */
  labelledBy: string;
};

/** Full-width banner detailing the selected project. */
export function ProjectPreview({
  project,
  panelId,
  labelledBy,
}: ProjectPreviewProps) {
  const { links } = project;

  return (
    <SurfaceCard
      id={panelId}
      role="tabpanel"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      className="mb-10 p-6 sm:p-8"
    >
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
        {/*
         * Keyed so the copy re-animates when the selection changes — and keyed *here*,
         * around the copy alone, rather than around the whole row. A key on the row tore
         * down the preview window too, and with the carousel advancing every few seconds
         * the trailer was remounted before it had finished loading, so it never appeared.
         */}
        <div key={project.slug} className="animate-fade-rise space-y-4 lg:col-span-5">
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
            <span className="font-semibold text-warm-accent">
              {project.category ? `${project.index} / ${project.category}` : project.index}
            </span>
            {project.year ? <span className="text-warm-slate">{project.year}</span> : null}
          </div>

          <h3 className="font-serif text-2xl text-warm-black sm:text-3xl">
            {project.title}
          </h3>
          {project.summary ? (
            <p className="text-sm leading-relaxed text-warm-slate sm:text-base">
              {project.summary}
            </p>
          ) : null}

          {/*
           * The banner used to print a row of headline figures here. They were placeholder
           * copy with nothing behind them on the API, so the domain — which the author does
           * write — takes the slot rather than inventing numbers to fill it.
           */}
          {project.domain ? (
            <dl className="flex flex-wrap gap-x-4 gap-y-2 border-y border-warm-border/60 py-2 font-mono text-xs text-warm-black">
              <div className="flex gap-1.5">
                <dt className="text-warm-slate">Domain:</dt>
                <dd className="font-semibold">{project.domain}</dd>
              </div>
            </dl>
          ) : null}

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            {links.repo ? (
              <a
                href={links.repo}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg bg-warm-black px-4 py-2 font-mono text-xs font-medium text-warm-bg transition-colors hover:bg-black"
              >
                <span>GitHub Repo</span>
                <span aria-hidden>↗</span>
              </a>
            ) : null}
            {links.demo ? (
              <a
                href={links.demo}
                className="flex items-center gap-2 rounded-lg border border-warm-border bg-warm-surface px-4 py-2 font-mono text-xs text-warm-black transition-colors hover:bg-warm-hover"
              >
                <span>Live Playground</span>
                <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
              </a>
            ) : null}
            {links.spec ? (
              <a
                href={links.spec}
                className="rounded-lg border border-transparent px-4 py-2 font-mono text-xs text-warm-slate transition-colors hover:border-warm-border hover:text-warm-black"
              >
                Read Architecture RFC →
              </a>
            ) : null}
          </div>
        </div>

        {/* Deliberately not keyed: React updates the existing <img>/<video> in place
            instead of replacing it, so switching projects does not restart the load. */}
        <div className="lg:col-span-7">
          <PreviewWindow project={project} />
        </div>
      </div>
    </SurfaceCard>
  );
}
