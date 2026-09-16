import React from "react";

export interface PeopleImageProps {
  src: string;
  alt: string;
  name: string;
  role: string;
  quote: string;
  badge?: string;
  className?: string;
}

export function PeopleImage({
  src,
  alt,
  name,
  role,
  quote,
  badge = "Creator Story",
  className = "",
}: PeopleImageProps) {
  return (
    <figure
      className={`relative overflow-hidden rounded-2xl bg-warm-surface p-3 shadow-card ring-1 ring-warm-border/70 ${className}`}
    >
      {/* Editorial Photograph */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-warm-sunken">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover object-center"
        />

        {/* Ambient Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Floating Top Badge */}
        <div className="absolute top-2.5 left-2.5">
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-warm-surface/90 text-warm-black"
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
      <figcaption className="mt-3 px-1">
        <div>
          <h4 className="text-sm font-medium text-warm-black tracking-tight">
            {name}
          </h4>
          <p className="text-xs text-warm-slate font-sans">{role}</p>
        </div>
      </figcaption>
    </figure>
  );
}
