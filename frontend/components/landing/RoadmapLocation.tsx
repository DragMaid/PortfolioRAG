import React from "react";

export interface RoadmapStepData {
  id: string;
  step: string;
  title: string;
  concept: "Create" | "Connect" | "Build" | "Automate";
  waypointCode: string;
  coordinates: string;
  elevation: string;
  description: string;
  details: string[];
  themeColor: "amber" | "sky" | "indigo" | "emerald";
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
  isActive = false,
}: RoadmapLocationProps) {
  const colorStyles = {
    amber: {
      pinBg: "bg-amber-500",
      pinRing: "border-amber-300 ring-amber-400/30",
      badge: "bg-amber-50 text-amber-800 border-amber-200",
      accent: "text-amber-600",
      glow: "from-amber-500/15 to-transparent",
    },
    sky: {
      pinBg: "bg-sky-500",
      pinRing: "border-sky-300 ring-sky-400/30",
      badge: "bg-sky-50 text-sky-800 border-sky-200",
      accent: "text-sky-600",
      glow: "from-sky-500/15 to-transparent",
    },
    indigo: {
      pinBg: "bg-indigo-500",
      pinRing: "border-indigo-300 ring-indigo-400/30",
      badge: "bg-indigo-50 text-indigo-800 border-indigo-200",
      accent: "text-indigo-600",
      glow: "from-indigo-500/15 to-transparent",
    },
    emerald: {
      pinBg: "bg-emerald-500",
      pinRing: "border-emerald-300 ring-emerald-400/30",
      badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
      accent: "text-emerald-600",
      glow: "from-emerald-500/15 to-transparent",
    },
  }[data.themeColor];

  return (
    <article
      className={`group relative flex flex-col rounded-2xl bg-white/90 p-5 sm:p-6 shadow-xl ring-1 ring-black/5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${className}`}
    >
      {/* Subtle ambient gradient corner */}
      <div
        className={`pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-gradient-to-br ${colorStyles.glow} blur-2xl`}
      />

      {/* Cartographic Header */}
      <div className="flex items-center justify-between border-b border-warm-border/60 pb-3">
        <div className="flex items-center gap-2">
          {/* Animated Map Pin Landmark */}
          <div className="relative flex h-8 w-8 items-center justify-center">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping ${colorStyles.pinBg}`}
            />
            <div
              className={`relative flex h-7 w-7 items-center justify-center rounded-full text-white text-xs font-mono font-bold shadow-md ring-4 ${colorStyles.pinBg} ${colorStyles.pinRing}`}
            >
              {index + 1}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-warm-slate">
              <span className="font-semibold text-warm-black">{data.waypointCode}</span>
              <span>•</span>
              <span>{data.elevation}</span>
            </div>
            <p className="font-mono text-[10px] text-warm-slate/80">{data.coordinates}</p>
          </div>
        </div>

        {/* Stage Concept Pill: Create / Connect / Build / Automate */}
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase border ${colorStyles.badge}`}
        >
          {data.concept}
        </span>
      </div>

      {/* Main Content Area */}
      <div className="mt-4 flex-1">
        <h3 className="text-xl sm:text-2xl font-serif font-medium text-warm-black tracking-tight">
          {data.title}
        </h3>
        <p className="mt-2 text-sm text-warm-slate leading-relaxed font-sans">
          {data.description}
        </p>
      </div>

      {/* Technical bullet highlights */}
      <ul className="mt-5 space-y-2 border-t border-warm-border/50 pt-3">
        {data.details.map((detail, idx) => (
          <li
            key={idx}
            className="flex items-center gap-2 text-xs text-warm-slate font-sans"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${colorStyles.pinBg}`} />
            <span>{detail}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
