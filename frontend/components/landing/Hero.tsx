"use client";

import React, { useState } from "react";
import Link from "next/link";
import { GearIllustration } from "./GearIllustration";
import { FlowerIllustration } from "./FlowerIllustration";

export function Hero() {
  const [activeSide, setActiveSide] = useState<"both" | "tech" | "creative">("both");

  return (
    <section
      className="relative w-full overflow-hidden bg-[#0b0f19] min-h-[94vh] lg:min-h-screen flex flex-col justify-between"
      aria-label="Hero: Where technical infrastructure meets creative expression"
    >
      {/* ------------------------------------------------------------- */}
      {/* DESKTOP / TABLET DUAL-WORLD SPLIT                             */}
      {/* ------------------------------------------------------------- */}

      {/* RIGHT SIDE WORLD: Creativity & Organic Expression (Base Layer) */}
      <div
        className={`absolute inset-0 bg-[#fbf9f4] text-[#1f2421] transition-opacity duration-700 select-none ${
          activeSide === "tech" ? "opacity-30" : "opacity-100"
        }`}
        onMouseEnter={() => setActiveSide("creative")}
        onMouseLeave={() => setActiveSide("both")}
      >
        {/* Subtle Organic Warm Glow & Noise */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_70%_20%,rgba(254,215,170,0.45),rgba(251,249,244,0))]" />
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-rose-100/60 blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-20 h-80 w-80 rounded-full bg-amber-100/50 blur-3xl pointer-events-none" />

        {/* Flower Illustration in Right World */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 lg:translate-x-4 w-[380px] sm:w-[460px] lg:w-[560px] xl:w-[640px] aspect-square pointer-events-none z-0">
          <FlowerIllustration className="w-full h-full" />
        </div>

        {/* Right Half Content Container */}
        <div className="relative z-10 h-full w-full max-w-7xl mx-auto px-6 sm:px-12 flex flex-col justify-center items-end">
          <div className="w-full lg:w-[48%] flex flex-col items-start text-left lg:pl-10">
            {/* Organic Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-medium tracking-wide uppercase shadow-sm">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Creative Freedom
            </div>

            {/* Right Headline: originates near center, animates right */}
            <h1
              className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-serif font-normal tracking-tight text-[#1c1917] leading-[1.1] animate-hero-right"
              style={{ textWrap: "balance" }}
            >
              You express yourself to the fullest
            </h1>

            {/* Creative Narrative */}
            <p className="mt-5 text-base sm:text-lg text-warm-slate max-w-md font-sans leading-relaxed">
              Design freely, write boldly, and shape immersive digital spaces.
              Your vision commands the front; zero cognitive drag from servers
              or migrations.
            </p>

            {/* Creative Feature Sparks */}
            <div className="mt-8 flex flex-wrap gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-[#f2ede4] text-[#44403c]">
                <svg className="w-3.5 h-3.5 text-rose-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Markdown & Rich Studio
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-[#f2ede4] text-[#44403c]">
                <svg className="w-3.5 h-3.5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Custom Editorial Layouts
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-[#f2ede4] text-[#44403c]">
                <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Instant Vector AI Search
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* LEFT SIDE WORLD: Complexity & Technical Machinery (Clipped Diagonal Overlay) */}
      <div
        className={`absolute inset-0 z-20 bg-[#0c101c] text-white transition-opacity duration-700 [clip-path:polygon(0_0,100%_0,100%_48%,0_52%)] sm:[clip-path:polygon(0_0,66%_0,36%_100%,0_100%)] lg:[clip-path:polygon(0_0,58%_0,40%_100%,0_100%)] ${
          activeSide === "creative" ? "opacity-40" : "opacity-100"
        }`}
        onMouseEnter={() => setActiveSide("tech")}
        onMouseLeave={() => setActiveSide("both")}
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
        <div className="absolute -top-20 -left-20 h-96 w-96 rounded-full bg-cyan-950/40 blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-10 h-96 w-96 rounded-full bg-blue-900/30 blur-3xl pointer-events-none" />

        {/* Gear Illustration in Left World */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 lg:-translate-x-6 w-[380px] sm:w-[460px] lg:w-[560px] xl:w-[640px] aspect-square pointer-events-none z-0">
          <GearIllustration className="w-full h-full" />
        </div>

        {/* Left Half Content Container */}
        <div className="relative z-10 h-full w-full max-w-7xl mx-auto px-6 sm:px-12 flex flex-col justify-center items-start">
          <div className="w-full lg:w-[46%] flex flex-col items-start text-left">
            {/* Technical Status Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 font-mono text-xs tracking-wider uppercase backdrop-blur-md shadow-sm">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              INFRA_ENGINE :: ACTIVE
            </div>

            {/* Left Headline: originates near center, animates left */}
            <h1
              className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-sans font-bold tracking-tight text-white leading-[1.1] animate-hero-left"
              style={{ textWrap: "balance" }}
            >
              We handle the complex stuff
            </h1>

            {/* Technical Narrative */}
            <p className="mt-5 text-base sm:text-lg text-slate-300 max-w-md font-sans leading-relaxed">
              OpenAPI generation, schema migrations, edge caching, and automated
              vector embedding pipelines. Built to absorb complexity silently.
            </p>

            {/* Technical Node Telemetry Pills */}
            <div className="mt-8 flex flex-wrap gap-2.5 font-mono text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-700/80 bg-slate-900/70 text-cyan-300">
                <span className="text-slate-500">$</span> openapi: v3.0.3
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-700/80 bg-slate-900/70 text-indigo-300">
                <span className="text-slate-500">λ</span> edge: 14ms
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-700/80 bg-slate-900/70 text-emerald-300">
                <span className="text-slate-500">●</span> rag: 1536-dim
              </span>
            </div>
          </div>
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

          {/* Glowing boundary line matching the polygon coordinates */}
          <line
            x1="580"
            y1="0"
            x2="400"
            y2="1000"
            stroke="url(#seamGradient)"
            strokeWidth="2.5"
            className="animate-seam"
          />
          <line
            x1="580"
            y1="0"
            x2="400"
            y2="1000"
            stroke="url(#seamGradient)"
            strokeWidth="8"
            opacity="0.3"
            filter="url(#seamGlowFilter)"
          />
        </svg>

        {/* Meeting Point Emblem (Center of the Hero) */}
        <div className="absolute top-1/2 left-[49%] -translate-x-1/2 -translate-y-1/2 z-40">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/90 border border-white/20 text-white shadow-2xl backdrop-blur-md">
            <span className="text-[10px] font-mono tracking-widest text-cyan-400">INFRA</span>
            <span className="text-xs text-amber-400">⇄</span>
            <span className="text-[10px] font-mono tracking-widest text-rose-300">ART</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* UNIFIED PRIMARY CTA / BOTTOM BAR                              */}
      {/* ------------------------------------------------------------- */}
      <div className="relative z-30 w-full pb-8 pt-4 px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left Status pill */}
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>zero-config headless backend</span>
        </div>

        {/* Central Action Dock */}
        <div className="flex items-center gap-3 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-1.5 rounded-full shadow-xl backdrop-blur-md">
          <Link
            href="/admin"
            className="px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            Start Building Free
          </Link>
          <a
            href="#roadmap"
            className="px-4 py-2.5 rounded-full text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors flex items-center gap-1.5"
          >
            <span>Explore The Journey</span>
            <svg
              className="w-4 h-4 text-slate-400 transition-transform group-hover:translate-y-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </a>
        </div>

        {/* Right Subtle Metric */}
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-warm-slate">
          <span>built for next-generation platforms</span>
        </div>
      </div>
    </section>
  );
}
