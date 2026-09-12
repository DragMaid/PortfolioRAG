"use client";

import { useState } from "react";
import Link from "next/link";
import { GearIllustration } from "./GearIllustration";
import { FlowerIllustration } from "./FlowerIllustration";

export function Hero() {
  const [activeSide, setActiveSide] = useState<"both" | "tech" | "creative">("both");

  /**
   * Only fine pointers get the dim-the-other-world treatment. iPadOS fires
   * pointerenter on tap, which would otherwise leave a half-faded hero on screen
   * with no way to undo it.
   */
  const hoverOnly =
    (side: "tech" | "creative" | "both") => (event: React.PointerEvent) => {
      if (event.pointerType === "mouse") setActiveSide(side);
    };

  return (
    <section
      className="relative w-full overflow-hidden bg-[#0b0f19] min-h-[100svh] flex flex-col"
      aria-label="Hero: Where technical infrastructure meets creative expression"
    >
      {/* ------------------------------------------------------------- */}
      {/* WORLD BACKDROPS                                               */}
      {/* Mobile: stacked horizontally-split bands (dark top / warm      */}
      {/* bottom). Tablet & up: the diagonal dual-world seam.            */}
      {/* ------------------------------------------------------------- */}

      {/* RIGHT SIDE WORLD: Creativity & Organic Expression (Base Layer) */}
      <div
        className={`absolute inset-0 bg-[#fbf9f4] text-[#1f2421] transition-opacity duration-700 select-none ${
          activeSide === "tech" ? "opacity-30" : "opacity-100"
        }`}
        onPointerEnter={hoverOnly("creative")}
        onPointerLeave={hoverOnly("both")}
        aria-hidden="true"
      >
        {/* Subtle Organic Warm Glow & Noise */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_70%_20%,rgba(254,215,170,0.45),rgba(251,249,244,0))]" />
        <div className="absolute -top-24 -right-24 h-72 w-72 sm:h-96 sm:w-96 rounded-full bg-rose-100/60 blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 sm:right-20 h-64 w-64 sm:h-80 sm:w-80 rounded-full bg-amber-100/50 blur-3xl pointer-events-none" />

        {/* Flower Illustration — lives in the lower band on mobile, right world on tablet+ */}
        <div className="absolute right-0 top-[74%] sm:top-[60%] lg:top-[56%] -translate-y-1/2 translate-x-16 sm:translate-x-[22%] lg:translate-x-[10%] w-[260px] sm:w-[420px] md:w-[500px] lg:w-[560px] xl:w-[640px] aspect-square opacity-50 sm:opacity-75 lg:opacity-90 pointer-events-none z-0">
          <FlowerIllustration className="w-full h-full" />
        </div>
      </div>

      {/* LEFT SIDE WORLD: Complexity & Technical Machinery (Clipped Overlay) */}
      <div
        className={`absolute inset-0 z-20 bg-[#0c101c] text-white transition-opacity duration-700 [clip-path:polygon(0_0,100%_0,100%_48%,0_52%)] sm:[clip-path:polygon(0_0,56%_0,44%_100%,0_100%)] lg:[clip-path:polygon(0_0,58%_0,40%_100%,0_100%)] ${
          activeSide === "creative" ? "opacity-40" : "opacity-100"
        }`}
        onPointerEnter={hoverOnly("tech")}
        onPointerLeave={hoverOnly("both")}
        aria-hidden="true"
      >
        {/* Architectural Tech Blueprint Grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(#38bdf8 1px, transparent 1px), linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)",
            backgroundSize: "32px 32px, 96px 96px, 96px 96px",
          }}
        />

        {/* Ambient Cyan Radial Glow */}
        <div className="absolute -top-20 -left-20 h-72 w-72 sm:h-96 sm:w-96 rounded-full bg-cyan-950/40 blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-10 h-72 w-72 sm:h-96 sm:w-96 rounded-full bg-blue-900/30 blur-3xl pointer-events-none" />

        {/* Gear Illustration — upper band on mobile, left world on tablet+ */}
        <div className="absolute left-0 top-[24%] sm:top-[42%] lg:top-[46%] -translate-y-1/2 -translate-x-16 sm:-translate-x-[22%] lg:-translate-x-[10%] w-[260px] sm:w-[420px] md:w-[500px] lg:w-[560px] xl:w-[640px] aspect-square opacity-50 sm:opacity-75 lg:opacity-90 pointer-events-none z-0">
          <GearIllustration className="w-full h-full" />
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* THE DIAGONAL SEAM & LUMINESCENT BOUNDARY                       */}
      {/* ------------------------------------------------------------- */}
      <div
        className="pointer-events-none absolute inset-0 z-30 hidden sm:block overflow-hidden"
        aria-hidden="true"
      >
        <svg
          className="w-full h-full"
          preserveAspectRatio="none"
          viewBox="0 0 1000 1000"
        >
          <defs>
            <linearGradient id="seamGradient" x1="60%" y1="0%" x2="40%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
              <stop offset="48%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="52%" stopColor="#fb923c" stopOpacity="1" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.9" />
            </linearGradient>
            <filter id="seamGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>

          {/* Glowing boundary line — one pair per breakpoint, tracking the clip-path seam */}
          <g className="lg:hidden">
            <line x1="560" y1="0" x2="440" y2="1000" stroke="url(#seamGradient)" strokeWidth="2.5" className="animate-seam" />
            <line x1="560" y1="0" x2="440" y2="1000" stroke="url(#seamGradient)" strokeWidth="8" opacity="0.3" filter="url(#seamGlowFilter)" />
          </g>
          <g className="hidden lg:block">
            <line x1="580" y1="0" x2="400" y2="1000" stroke="url(#seamGradient)" strokeWidth="2.5" className="animate-seam" />
            <line x1="580" y1="0" x2="400" y2="1000" stroke="url(#seamGradient)" strokeWidth="8" opacity="0.3" filter="url(#seamGlowFilter)" />
          </g>
        </svg>
      </div>

      {/* Mobile-only seam: a thin luminous rule along the horizontal band split */}
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 z-30 h-px sm:hidden bg-gradient-to-r from-cyan-400 via-white to-rose-400 opacity-80 rotate-[-2.3deg] origin-center"
        aria-hidden="true"
      />

      {/* ------------------------------------------------------------- */}
      {/* COPY — stacked in flow inside the two colour bands on phones,     */}
      {/* placed by percentage either side of the diagonal on tablet+.   */}
      {/* ------------------------------------------------------------- */}
      <div className="relative z-40 flex-1 w-full max-w-7xl mx-auto px-6 pt-[4.5rem] grid grid-rows-2 gap-y-6 sm:block sm:p-0">
        {/* Technical half — pinned to the upper left of the diagonal on tablet+ */}
        <div className="flex flex-col justify-center sm:absolute sm:top-[32%] sm:-translate-y-1/2 sm:left-10 lg:left-16 sm:w-[40%]">
          <div className="relative">
            {/* Scrim: keeps the copy legible where the gears pass behind it */}
            <div
              className="pointer-events-none absolute -inset-x-8 -inset-y-10 hidden sm:block bg-[radial-gradient(ellipse_at_center,rgba(12,16,28,0.85),rgba(12,16,28,0.45)_55%,transparent_80%)] blur-md"
              aria-hidden="true"
            />
            <h1
              className="relative text-[1.75rem] min-[380px]:text-[2rem] leading-[1.12] sm:text-4xl md:text-5xl xl:text-6xl font-sans font-bold tracking-tight text-white animate-hero-left"
              style={{ textWrap: "balance" }}
            >
              We handle the complex stuff
            </h1>
            <p className="relative mt-3 sm:mt-5 text-sm sm:text-base lg:text-lg text-slate-300 max-w-md font-sans leading-relaxed">
              OpenAPI generation, schema migrations, edge caching, and automated
              vector embedding pipelines. Built to absorb complexity silently.
            </p>
          </div>
        </div>

        {/* Creative half — pinned to the lower right of the diagonal on tablet+ */}
        <div className="flex flex-col justify-center sm:absolute sm:top-[58%] sm:-translate-y-1/2 sm:right-10 lg:right-16 sm:w-[40%] lg:w-[38%]">
          <div className="relative">
            {/* Scrim: keeps the copy legible where the flower passes behind it */}
            <div
              className="pointer-events-none absolute -inset-x-8 -inset-y-10 hidden sm:block bg-[radial-gradient(ellipse_at_center,rgba(251,249,244,0.92),rgba(251,249,244,0.6)_55%,transparent_80%)] blur-md"
              aria-hidden="true"
            />
            <h2
              className="relative text-[1.75rem] min-[380px]:text-[2rem] leading-[1.12] sm:text-4xl md:text-5xl xl:text-6xl font-serif font-normal tracking-tight text-[#1c1917] animate-hero-right"
              style={{ textWrap: "balance" }}
            >
              You express yourself to the fullest
            </h2>
            <p className="relative mt-3 sm:mt-5 text-sm sm:text-base lg:text-lg text-warm-slate max-w-md font-sans leading-relaxed">
              Design freely, write boldly, and shape immersive digital spaces.
              Your vision commands the front; zero cognitive drag from servers
              or migrations.
            </p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ACTION DOCK — in flow at the foot on phones, floated over the  */}
      {/* seam on tablet and up. The primary CTA carries the weight.     */}
      {/* ------------------------------------------------------------- */}
      <div className="relative z-50 w-full px-6 pb-8 sm:px-0 sm:pb-0 sm:absolute sm:top-[82%] sm:left-1/2 sm:w-auto sm:max-w-full sm:-translate-x-1/2 sm:-translate-y-1/2">
        {/* Halo that pulls the eye to the dock */}
        <div
          className="pointer-events-none absolute -inset-4 sm:-inset-10 rounded-[3rem] bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.22),rgba(99,102,241,0.08),transparent_70%)] sm:bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.35),rgba(99,102,241,0.12),transparent_70%)] blur-2xl"
          aria-hidden="true"
        />

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-3xl sm:rounded-full bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-2 shadow-2xl backdrop-blur-md">
          <Link
            href="/admin"
            className="group relative flex items-center justify-center gap-2 rounded-2xl sm:rounded-full px-6 py-4 sm:py-3.5 min-h-[52px] text-base sm:text-[0.95rem] font-bold tracking-tight text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-[0_8px_24px_-6px_rgba(56,189,248,0.7)] ring-1 ring-inset ring-white/25 transition-all duration-200 hover:shadow-[0_12px_32px_-6px_rgba(56,189,248,0.9)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 whitespace-nowrap"
          >
            <span>Start Building Free</span>
            <svg
              className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 12h14m0 0l-6-6m6 6l-6 6" />
            </svg>
          </Link>

          <a
            href="#roadmap"
            className="group flex items-center justify-center gap-1.5 rounded-2xl sm:rounded-full px-5 py-3 min-h-[44px] text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 whitespace-nowrap"
          >
            <span>Explore The Journey</span>
            <svg
              className="w-4 h-4 text-slate-400 transition-transform duration-200 group-hover:translate-y-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </a>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* BOTTOM STATUS BAR (tablet and up — the phone layout gives this */}
      {/* space to the action dock instead)                              */}
      {/* ------------------------------------------------------------- */}
      <div className="relative z-30 hidden md:flex w-full pb-8 pt-4 px-6 sm:px-12 items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 pointer-events-auto">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>zero-config headless backend</span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-warm-slate pointer-events-auto">
          <span>built for next-generation platforms</span>
        </div>
      </div>
    </section>
  );
}
