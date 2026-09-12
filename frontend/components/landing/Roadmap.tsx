"use client";

import { RoadmapLocation, type RoadmapStepData } from "./RoadmapLocation";
import { PeopleImage } from "./PeopleImage";

const ROADMAP_STEPS: RoadmapStepData[] = [
  {
    id: "step-1",
    step: "01",
    title: "Create Posts & Get API",
    concept: "Create & Connect",
    elevation: "Elev. 120m",
    description:
      "Draft stories in Markdown with real-time preview. Your published entries immediately generate structured REST endpoints with OpenAPI 3.0 specs.",
    details: [
      "Distraction-free Markdown editor",
      "Automatic OpenAPI 3.0 schema generation",
      "Zero-latency edge CDN caching",
    ],
    themeColor: "amber",
  },
  {
    id: "step-2",
    step: "02",
    title: "Build Frontend",
    concept: "Build",
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
    id: "step-3",
    step: "03",
    title: "RAG handles the rest",
    concept: "Automate",
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
        </svg>
      </div>

      <div className="relative mx-auto max-w-7xl px-6 sm:px-12">
        {/* Section Header with Editorial Precision */}
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mt-6 text-3xl sm:text-4xl md:text-5xl font-serif font-normal tracking-tight text-warm-black">
            The Cartography of Effortless Publishing
          </h2>

          <p className="mt-4 text-base sm:text-lg text-warm-slate font-sans leading-relaxed">
            A continuous journey from raw thoughts to automated AI intelligence.
            Follow the path:
          </p>

          {/* Visual Route Breadcrumbs: Create & Connect -> Build -> Automate */}
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-warm-border/80 bg-white/70 px-5 py-2 text-xs sm:text-sm font-semibold text-warm-black shadow-sm backdrop-blur-md">
            <span className="text-amber-600">Create & Connect</span>
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
                  <stop offset="50%" stopColor="#6366f1" />
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

          {/* Grid Layout of the 3 Waypoints + 2 Editorial People Images */}
          <div className="space-y-12 sm:space-y-16 lg:space-y-24">
            {/* ROW 1: Waypoint 1 (Create & Connect) + Person 1 (Elena Vance) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Waypoint 1: Left */}
              <div className="lg:col-span-6 lg:pr-8">
                <RoadmapLocation data={ROADMAP_STEPS[0]} index={0} />
              </div>

              {/* Person 1 Editorial Image: Floating near stage 1 */}
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

            {/* ROW 2: Person 2 (Marcus Chen) + Waypoint 2 (Build Frontend) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Person 2 Editorial Image: Floating near stage 2 */}
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

              {/* Waypoint 2: Right */}
              <div className="order-1 lg:order-2 lg:col-span-6 lg:col-start-7 lg:pl-8">
                <RoadmapLocation data={ROADMAP_STEPS[1]} index={1} />
              </div>
            </div>

            {/* ROW 3: Waypoint 3 (RAG handles the rest) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 lg:col-start-3">
                <RoadmapLocation
                  data={ROADMAP_STEPS[2]}
                  index={2}
                  className="ring-2 ring-emerald-500/30"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
