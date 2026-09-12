import React from "react";

export interface PeopleImageProps {
  src: string;
  alt: string;
  name: string;
  role: string;
  quote: string;
  badge?: string;
  className?: string;
  tagColor?: "coral" | "emerald" | "sky" | "amber";
}

export function PeopleImage({
  src,
  alt,
  name,
  role,
  quote,
  badge = "Creator Story",
  className = "",
  tagColor = "coral",
}: PeopleImageProps) {
  const badgeClasses = {
    coral: "bg-rose-50 text-rose-700 border-rose-200/80",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    sky: "bg-sky-50 text-sky-700 border-sky-200/80",
    amber: "bg-amber-50 text-amber-800 border-amber-200/80",
  }[tagColor];

  return (
    <figure
      className={`group relative overflow-hidden rounded-2xl bg-white/90 p-3 shadow-xl ring-1 ring-black/5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${className}`}
    >
      {/* Editorial Photograph */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-warm-sunken">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
        />

        {/* Ambient Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-40" />

        {/* Floating Top Badge */}
        <div className="absolute top-2.5 left-2.5">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border shadow-sm backdrop-blur-md ${badgeClasses}`}
          >
            {badge}
          </span>
        </div>

        {/* Overlay quote on image bottom */}
        <blockquote className="absolute bottom-3 left-3 right-3 text-white">
          <p className="text-xs font-serif italic leading-snug drop-shadow-sm">
            &ldquo;{quote}&rdquo;
          </p>
        </blockquote>
      </div>

      {/* Caption & Identity */}
      <figcaption className="mt-3 flex items-center justify-between px-1">
        <div>
          <h4 className="text-sm font-semibold text-warm-black tracking-tight">
            {name}
          </h4>
          <p className="text-xs text-warm-slate font-sans">{role}</p>
        </div>
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-warm-sunken text-warm-slate transition-colors group-hover:bg-warm-black group-hover:text-white">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </div>
      </figcaption>
    </figure>
  );
}
