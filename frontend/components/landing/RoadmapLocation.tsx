export interface RoadmapStepData {
  id: string;
  step: string;
  title: string;
  concept: "Create & Connect" | "Build" | "Automate";
  elevation: string;
  description: string;
  details: string[];
}

interface RoadmapLocationProps {
  data: RoadmapStepData;
  index: number;
  className?: string;
  isActive?: boolean;
}

export function RoadmapLocation({
  data,
  index,
  className = "",
}: RoadmapLocationProps) {
  return (
    <article
      className={`relative flex flex-col rounded-sm bg-warm-surface p-5 sm:p-7 shadow-card ring-1 ring-warm-border/70 transition-shadow duration-300 hover:shadow-subtle ${className}`}
    >
      {/* Cartographic Header */}
      <div className="flex items-center justify-between border-b border-warm-hairline pb-3">
        {/* Map pin landmark */}
        <span className="animate-waypoint-reach flex h-7 w-7 items-center justify-center rounded-full border border-warm-border text-xs font-mono text-warm-slate">
          {index + 1}
        </span>

        {/* Stage concept: Create & Connect / Build / Automate */}
        <span className="text-xs font-medium text-warm-accent">
          {data.concept}
        </span>
      </div>

      {/* Main Content Area */}
      <div className="mt-5 flex-1">
        <h3 className="text-xl sm:text-2xl font-serif font-normal text-warm-black tracking-tight">
          {data.title}
        </h3>
        <p className="mt-2 text-sm text-warm-slate leading-relaxed font-sans">
          {data.description}
        </p>
      </div>

      {/* Technical bullet highlights */}
      <ul className="mt-5 space-y-2 border-t border-warm-hairline pt-4">
        {data.details.map((detail, idx) => (
          <li
            key={idx}
            className="flex items-center gap-2.5 text-xs text-warm-slate font-sans"
          >
            <span className="h-1 w-1 rounded-full bg-warm-accent" />
            <span>{detail}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
