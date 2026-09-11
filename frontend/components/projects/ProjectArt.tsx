import type { ProjectThumbnail } from "@/lib/types";

/** Backdrop wash behind each card's art, keyed to the project kind. */
export const thumbnailGradient: Record<ProjectThumbnail, string> = {
  vector: "from-warm-bg to-warm-hover",
  shader: "from-[#EAE6DF] to-warm-hover",
  kernel: "from-warm-hover to-warm-bg",
  kinetic: "from-warm-bg to-warm-border/30",
  lsm: "from-warm-hover to-warm-bg",
  wire: "from-[#EFEBE4] to-warm-bg",
};

const art: Record<ProjectThumbnail, React.ReactNode> = {
  /* Vector index: a point inside a rotated search envelope. */
  vector: (
    <div className="relative flex size-20 items-center justify-center rounded-xl border border-warm-border bg-warm-surface/80 shadow-sm">
      <div className="flex size-10 rotate-45 items-center justify-center rounded border-2 border-dashed border-warm-accent">
        <div className="size-4 rounded-full bg-warm-black" />
      </div>
    </div>
  ),
  /* Shader workbench: uniform sliders. */
  shader: (
    <div className="flex h-16 w-24 items-center justify-around rounded-lg border border-warm-border bg-warm-surface px-3 shadow-sm">
      <span className="h-10 w-2 rounded-full bg-warm-black" />
      <span className="h-12 w-2 rounded-full bg-warm-accent" />
      <span className="h-8 w-2 rounded-full bg-warm-slate/60" />
      <span className="h-14 w-2 rounded-full bg-warm-black" />
    </div>
  ),
  /* Kernel hook: XDP attach ring. */
  kernel: (
    <div className="flex size-20 items-center justify-center rounded-full border-2 border-warm-black/70">
      <div className="flex size-12 items-center justify-center rounded-full border border-dashed border-warm-accent">
        <span className="font-mono text-[10px] font-bold text-warm-black">XDP</span>
      </div>
    </div>
  ),
  /* Design system: a focused primitive between two siblings. */
  kinetic: (
    <div className="flex items-center gap-2">
      <div className="h-14 w-7 rounded-lg border border-warm-border bg-warm-surface shadow-sm" />
      <div className="flex h-16 w-10 items-center justify-center rounded-xl bg-warm-black font-mono text-xs font-bold text-warm-bg">
        AAA
      </div>
      <div className="h-14 w-7 rounded-lg border border-warm-border bg-warm-surface shadow-sm" />
    </div>
  ),
  /* Storage engine: LSM levels widening as they compact down. */
  lsm: (
    <div className="space-y-1">
      <div className="h-4 w-24 rounded bg-warm-black" />
      <div className="mx-auto h-4 w-20 rounded bg-warm-accent" />
      <div className="mx-auto h-4 w-16 rounded bg-warm-slate/50" />
    </div>
  ),
  /* Wire protocol: a framed packet, header then elided payload. */
  wire: (
    <div className="flex items-center gap-1.5 rounded-lg border border-warm-border bg-warm-surface px-3 py-4 shadow-sm">
      <span className="h-8 w-3 rounded-sm bg-warm-black" />
      <span className="h-8 w-1.5 rounded-sm bg-warm-accent" />
      <span className="h-8 w-8 rounded-sm border border-dashed border-warm-accent" />
      <span className="h-8 w-1.5 rounded-sm bg-warm-slate/50" />
      <span className="h-8 w-3 rounded-sm bg-warm-black" />
    </div>
  ),
};

/** Decorative mark standing in for a project screenshot. */
export function ProjectArt({ kind }: { kind: ProjectThumbnail }) {
  return (
    <div className="flex items-center justify-center py-2 transition-transform group-hover:scale-105">
      {art[kind]}
    </div>
  );
}
