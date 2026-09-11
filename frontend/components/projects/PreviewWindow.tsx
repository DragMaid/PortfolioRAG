import type { Project } from "@/lib/types";

/**
 * The project's trailer, in the mock application window the design frames it with.
 *
 * The window used to hold invented telemetry — stat tiles on made-up percentages and a
 * decorative neighbour graph — because there was nothing real to put in it. There is now:
 * every published project carries a trailer, so the frame shows the author's own footage
 * instead of numbers nobody measured.
 */
export function PreviewWindow({ project }: { project: Project }) {
  const { trailer, title } = project;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-warm-border bg-warm-bg shadow-inner">
      <div className="flex items-center justify-between gap-3 border-b border-warm-border bg-warm-hover/70 px-4 py-2.5 font-mono text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <div aria-hidden className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full bg-rose-400/80" />
            <span className="inline-block size-2.5 rounded-full bg-amber-400/80" />
            <span className="inline-block size-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <span className="ml-2 truncate rounded border border-warm-border/60 bg-warm-surface px-2 py-0.5 text-[11px] text-warm-slate">
            {project.slug}
          </span>
        </div>
        <span className="shrink-0 rounded border border-warm-border bg-warm-surface px-2 py-0.5 font-mono text-[10px] uppercase text-warm-slate">
          {trailer.isVideo ? "Trailer" : "Still"}
        </span>
      </div>

      <div className="aspect-video w-full bg-warm-sunken">
        {trailer.isVideo ? (
          /*
           * Muted and loopable so it can autoplay: a browser blocks autoplay with sound,
           * and a trailer that needs a click to start is a still with extra steps. Controls
           * stay on so it can be paused — an unpausable moving image on a page somebody is
           * reading is a nuisance, and for some readers a barrier.
           */
          <video
            src={trailer.url}
            controls
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={`Trailer for ${title}`}
            className="size-full object-cover"
          />
        ) : (
          /*
           * A signed link with a deadline; see ProjectCard for why the optimizer is
           * bypassed. Eager, because this is the section's hero image, drawn the moment the
           * banner is on screen — lazily loading the one picture the reader is looking at
           * only delays it.
           */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={trailer.url}
            alt={`Preview of ${title}`}
            decoding="async"
            className="size-full object-cover"
          />
        )}
      </div>
    </div>
  );
}
