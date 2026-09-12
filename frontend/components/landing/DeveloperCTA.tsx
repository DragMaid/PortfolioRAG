"use client";

import React from "react";
import Link from "next/link";
import { TerminalDemo } from "./TerminalDemo";

export function DeveloperCTA() {
  return (
    <section
      id="developer"
      className="relative w-full overflow-hidden bg-[#0a0d14] text-white py-24 sm:py-36"
      aria-label="Developer Playground and Call to Action"
    >
      {/* ------------------------------------------------------------- */}
      {/* BACKGROUND: Abstract Infrastructure Canvas & Radiant Glows     */}
      {/* ------------------------------------------------------------- */}
      <div
        className="pointer-events-none absolute inset-0 select-none opacity-20"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* Atmospheric Radial Gradients */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-cyan-600/15 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-indigo-600/10 blur-[100px]" />

      <div className="relative mx-auto max-w-7xl px-6 sm:px-12">
        {/* Section Header & Main CTA Statement */}
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-sans font-bold tracking-tight text-white leading-tight">
            Start building now.
          </h2>

          <p className="mt-5 text-base sm:text-lg text-slate-300 font-sans leading-relaxed max-w-2xl mx-auto">
            Take full command with instant OpenAPI endpoints, built-in vector search,
            and complete UI independence. One keystroke to launch your universe.
          </p>

          {/* Two Prominent Action Buttons with Clear Visual Hierarchy */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* Primary Action: Start Now */}
            <Link
              href="/admin"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 hover:from-cyan-400 hover:via-sky-400 hover:to-indigo-500 shadow-lg shadow-cyan-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              <span>Start Now</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>

            {/* Secondary Action: Read Documentation */}
            <a
              href="#terminal-preview"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full text-sm font-medium text-slate-200 border border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 hover:text-white hover:border-slate-500 backdrop-blur-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span>Read Documentation</span>
            </a>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* SURROUNDING INFRASTRUCTURE ENVIRONMENT FOR TERMINAL           */}
        {/* ------------------------------------------------------------- */}
        <div id="terminal-preview" className="relative mt-16 sm:mt-24">
          {/* Subtle Connection Lines (SVG) behind the terminal */}
          <div
            className="pointer-events-none absolute inset-0 hidden xl:block select-none overflow-visible"
            aria-hidden="true"
          >
            <svg
              className="h-full w-full"
              viewBox="0 0 1200 650"
              fill="none"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="connLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0.2" />
                </linearGradient>
              </defs>

              {/* Line: Node 1 (Top Left) to Terminal */}
              <path
                d="M 120 100 H 260 V 220"
                stroke="url(#connLineGrad)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <circle cx="120" cy="100" r="3" fill="#38bdf8" />
              <circle cx="260" cy="220" r="3" fill="#38bdf8" />

              {/* Line: Node 2 (Top Right) to Terminal */}
              <path
                d="M 1080 100 H 940 V 220"
                stroke="url(#connLineGrad)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <circle cx="1080" cy="100" r="3" fill="#818cf8" />
              <circle cx="940" cy="220" r="3" fill="#818cf8" />

              {/* Line: Node 3 (Bottom Left) to Terminal */}
              <path
                d="M 120 540 H 260 V 440"
                stroke="url(#connLineGrad)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <circle cx="120" cy="540" r="3" fill="#34d399" />
              <circle cx="260" cy="440" r="3" fill="#34d399" />

              {/* Line: Node 4 (Bottom Right) to Terminal */}
              <path
                d="M 1080 540 H 940 V 440"
                stroke="url(#connLineGrad)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <circle cx="1080" cy="540" r="3" fill="#fb923c" />
              <circle cx="940" cy="440" r="3" fill="#fb923c" />
            </svg>
          </div>

          {/* The Stylized Terminal Window */}
          <div className="relative mx-auto max-w-4xl shadow-2xl">
            <TerminalDemo />
          </div>
        </div>
      </div>
    </section>
  );
}
