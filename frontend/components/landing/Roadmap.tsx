"use client";

import React from "react";
import { RoadmapLocation, type RoadmapStepData } from "./RoadmapLocation";
import { PeopleImage } from "./PeopleImage";

const ROADMAP_STEPS: RoadmapStepData[] = [
  {
    id: "step-1",
    step: "01",
    title: "Create Posts",
    concept: "Create",
    waypointCode: "WP-01 // ALPHA",
    coordinates: "37°46'N 122°25'W",
    elevation: "Elev. 120m",
    description:
      "Draft stories, project breakdowns, and case studies in Markdown or rich text. Real-time preview, asset drag-and-drop, and revision history included.",
    details: [
      "Distraction-free Markdown editor",
      "Instant media upload & optimization",
      "Draft & published lifecycle flags",
    ],
    themeColor: "amber",
  },
  {
    id: "step-2",
    step: "02",
    title: "Get API",
    concept: "Connect",
    waypointCode: "WP-02 // BETA",
    coordinates: "40°42'N 74°00'W",
    elevation: "Elev. 340m",
    description:
      "Your published entries immediately generate structured REST endpoints with OpenAPI 3.0 specs. Secure Bearer auth and edge caching out of the box.",
    details: [
      "Automatic OpenAPI 3.0 schema generation",
      "Zero-latency edge CDN caching",
      "Granular author & public permissions",
    ],
    themeColor: "sky",
  },
  {
    id: "step-3",
    step: "03",
    title: "Build Frontend",
    concept: "Build",
    waypointCode: "WP-03 // GAMMA",
    coordinates: "51°30'N 0°07'W",
    elevation: "Elev. 580m",
    description:
      "Consume your content in Next.js, React, Astro, or native mobile apps using type-safe generated clients. You have absolute freedom over UI and animation.",
    details: [
      "Type-safe TypeScript SDK client",
      "100% framework agnostic architecture",
      "No vendor locked-in CSS or markup",
    ],
    themeColor: "indigo",
  },
  {
    id: "step-4",
    step: "04",
    title: "RAG handles the rest",
    concept: "Automate",
    waypointCode: "WP-04 // DELTA",
    coordinates: "35°41'N 139°41'E",
    elevation: "Elev. 890m",
    description:
      "Articles are automatically chunked and transformed into high-dimensional vector embeddings. Ready for semantic search and AI conversational assistants.",
    details: [
      "Automated semantic chunking & indexing",
      "Hybrid vector + lexical relevance search",
      "Plug-and-play LLM retrieval endpoints",
    ],
    themeColor: "emerald",
  },
];

export function Roadmap() {
  return (
    <section
      id="roadmap"
      className="relative w-full overflow-hidden bg-warm-bg py-24 sm:py-32"
      aria-label="Platform Roadmap: From Creation to Automation"
    >
      {/* ------------------------------------------------------------- */}
      {/* CARTOGRAPHIC BACKGROUND: Topo curves, grid lines & compass    */}
      {/* ------------------------------------------------------------- */}
      <div
        className="pointer-events-none absolute inset-0 select-none opacity-40"
        aria-hidden="true"
      >
        <svg
          className="h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1200 1200"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern
              id="cartoGrid"
              width="80"
              height="80"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 80 0 L 0 0 0 80"
                fill="none"
                stroke="#dedad2"
                strokeWidth="0.75"
                strokeDasharray="2 6"
              />
              <circle cx="0" cy="0" r="1.5" fill="#9a8f7a" />
            </pattern>
          </defs>

          {/* Grid pattern */}
          <rect width="100%" height="100%" fill="url(#cartoGrid)" opacity="0.6" />

          {/* Topographic Elevation Contour Lines */}
          <g fill="none" stroke="#dedad2" strokeWidth="1.25" opacity="0.8">
            <path d="M -100 200 C 200 150, 450 350, 700 220 C 950 90, 1100 250, 1300 200" />
            <path d="M -100 450 C 150 420, 380 600, 680 480 C 980 360, 1150 520, 1300 460" />
            <path d="M -100 700 C 250 680, 500 850, 800 720 C 1050 590, 1200 750, 1300 700" />
            <path d="M -100 950 C 180 920, 420 1100, 750 980 C 1000 860, 1180 1020, 1300 950" />
          </g>

          {/* Cartographic Coordinate Marks */}
          <g
            fontFamily="var(--font-mono)"
            fontSize="9"
            fill="#77736c"
            opacity="0.6"
          >
            <text x="60" y="80">42°00&apos;00&quot; N — 71°00&apos;00&quot; W</text>
            <text x="1000" y="80">SURVEY QUAD: SECTION 4-A</text>
            <text x="60" y="1160">CONTOUR INTERVAL: 25 METERS</text>
            <text x="960" y="1160">TERRAIN DATUM: WGS-84</text>
          </g>
        </svg>
      </div>

      <div className="relative mx-auto max-w-7xl px-6 sm:px-12">
        {/* Section Header with Editorial Precision */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-warm-border bg-warm-surface px-4 py-1.5 text-xs font-mono font-medium text-warm-slate shadow-sm">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span>NAVIGATION ROUTE // 4 WAYPOINTS</span>
          </div>

          <h2 className="mt-6 text-3xl sm:text-4xl md:text-5xl font-serif font-normal tracking-tight text-warm-black">
            The Cartography of Effortless Publishing
          </h2>

          <p className="mt-4 text-base sm:text-lg text-warm-slate font-sans leading-relaxed">
            A continuous journey from raw thoughts to automated AI intelligence.
            Follow the path:
          </p>

          {/* Visual Route Breadcrumbs: Create -> Connect -> Build -> Automate */}
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-warm-border/80 bg-white/70 px-5 py-2 text-xs sm:text-sm font-semibold text-warm-black shadow-sm backdrop-blur-md">
            <span className="text-amber-600">Create</span>
            <span className="text-warm-slate/40">→</span>
            <span className="text-sky-600">Connect</span>
            <span className="text-warm-slate/40">→</span>
            <span className="text-indigo-600">Build</span>
            <span className="text-warm-slate/40">→</span>
            <span className="text-emerald-600">Automate</span>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* DESKTOP & TABLET MAP VIEWPORT                                 */}
        {/* ------------------------------------------------------------- */}
        <div className="relative mt-16 sm:mt-24">
          {/* Animated Winding Route Line (Desktop & Tablet) */}
          <div
            className="pointer-events-none absolute inset-0 hidden lg:block select-none"
            aria-hidden="true"
          >
            <svg
              className="h-full w-full"
              viewBox="0 0 1000 1100"
              fill="none"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="routeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="33%" stopColor="#0ea5e9" />
                  <stop offset="66%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>

              {/* Underlying Route Halo */}
              <path
                d="M 280 120 C 500 120, 720 240, 720 380 C 720 540, 260 620, 260 760 C 260 920, 680 940, 720 1020"
                stroke="url(#routeGradient)"
                strokeWidth="10"
                strokeOpacity="0.15"
                strokeLinecap="round"
              />

              {/* Dynamic Dashed Traveled Route */}
              <path
                d="M 280 120 C 500 120, 720 240, 720 380 C 720 540, 260 620, 260 760 C 260 920, 680 940, 720 1020"
                stroke="url(#routeGradient)"
                strokeWidth="3.5"
                strokeDasharray="8 8"
                strokeLinecap="round"
                className="animate-path-dash"
              />
            </svg>
          </div>

          {/* Grid Layout of the 4 Waypoints + 2 Editorial People Images */}
          <div className="space-y-12 sm:space-y-16 lg:space-y-24">
            {/* ROW 1: Waypoint 1 (Create Posts) + Person 1 (Elena Vance) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Waypoint 1: Left */}
              <div className="lg:col-span-6 lg:pr-8">
                <RoadmapLocation data={ROADMAP_STEPS[0]} index={0} />
              </div>

              {/* Person 1 Editorial Image: Floating near stage 1/2 */}
              <div className="lg:col-span-5 lg:col-start-8">
                <PeopleImage
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=700&q=80"
                  alt="Elena Vance, Lead Designer & Independent Essayist"
                  name="Elena Vance"
                  role="Lead Designer & Independent Essayist"
                  quote="I write my stories in the studio and never think about servers or schemas. It just works."
                  badge="Creative Freedom"
                  tagColor="coral"
                  className="max-w-sm mx-auto lg:rotate-1"
                />
              </div>
            </div>

            {/* ROW 2: Waypoint 2 (Get API) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 lg:col-start-7 lg:pl-8">
                <RoadmapLocation data={ROADMAP_STEPS[1]} index={1} />
              </div>
            </div>

            {/* ROW 3: Person 2 (Marcus Chen) + Waypoint 3 (Build Frontend) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Person 2 Editorial Image: Floating near stage 3/4 */}
              <div className="order-2 lg:order-1 lg:col-span-5">
                <PeopleImage
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=700&q=80"
                  alt="Marcus Chen, Systems Architect"
                  name="Marcus Chen"
                  role="Systems Architect & Founder"
                  quote="The generated OpenAPI specs meant our frontend team built the app in an afternoon with zero backend friction."
                  badge="Rapid Shipping"
                  tagColor="sky"
                  className="max-w-sm mx-auto lg:-rotate-1"
                />
              </div>

              {/* Waypoint 3: Right */}
              <div className="order-1 lg:order-2 lg:col-span-6 lg:col-start-7 lg:pl-8">
                <RoadmapLocation data={ROADMAP_STEPS[2]} index={2} />
              </div>
            </div>

            {/* ROW 4: Waypoint 4 (RAG handles the rest) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 lg:col-start-3">
                <RoadmapLocation
                  data={ROADMAP_STEPS[3]}
                  index={3}
                  className="ring-2 ring-emerald-500/30"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Cartographic Compass Rose Footer */}
        <div className="mt-20 flex flex-col sm:flex-row items-center justify-between border-t border-warm-border pt-8 text-xs font-mono text-warm-slate gap-4">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-warm-accent animate-spin-cw-slow"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <polygon points="12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9" strokeWidth="1.5" />
            </svg>
            <span>ROUTE MAP // ALL NODES RESOLVED</span>
          </div>
          <div className="flex items-center gap-6">
            <span>WP-01 ➔ WP-04</span>
            <span>END-TO-END AUTOMATION READY</span>
          </div>
        </div>
      </div>
    </section>
  );
}
