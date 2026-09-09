import type { ExperienceEntry } from "@/lib/types";

/**
 * TODO: PLACEHOLDER — the backend has no experience/employment endpoint.
 *
 * Replace with a `getExperience()` loader once one exists. `ExperienceSection`
 * takes this array as a prop and derives the timeline geometry, the mobile
 * selector and the detail card from it, so any length >= 1 renders correctly.
 */
export const experiencePlaceholder: ExperienceEntry[] = [
  {
    id: "stripe",
    company: "Stripe",
    logo: "stripe",
    role: "Software Engineer — Core Infrastructure",
    team: "Global Financial Messaging Layer & Payment Settlement",
    period: "2019 — 2021",
    caption: "Stripe Payments",
    duration: "May 2019 — Sep 2021 (2.4 yrs)",
    shortLabel: "Stripe ('19)",
    highlights: [
      "Built high-availability idempotent settlement queue processing $4.2B in monthly gross volume.",
      "Decreased end-to-end ledger reconciliation duration from 4 hours to 18 minutes through stream pipelining.",
      "Hardened transactional replay protocols against partial multi-datacenter network partitions.",
    ],
  },
  {
    id: "vercel",
    company: "Vercel",
    logo: "vercel",
    role: "Senior Systems Engineer",
    team: "Edge Compute & Global Serverless Gateway",
    period: "2021 — 2023",
    caption: "Vercel Edge",
    duration: "Oct 2021 — Oct 2023 (2 yrs)",
    shortLabel: "Vercel ('21)",
    highlights: [
      "Led development of the isolated V8 runtime powering Vercel Edge Middleware globally.",
      "Implemented intelligent routing tier achieving cold-start invocation under 8ms across 300+ PoPs.",
      "Mentored 6 distributed systems engineers and authored 11 technical architectural specs.",
    ],
  },
  {
    id: "openai",
    company: "OpenAI",
    logo: "openai",
    role: "Staff Infrastructure Architect",
    team: "AI Research Platform & Distributed Compute Cluster",
    period: "2023 — Present",
    caption: "OpenAI Research",
    duration: "Nov 2023 — Present (1.5 yrs)",
    shortLabel: "OpenAI ('23)",
    highlights: [
      "Pioneered dynamic GPU tensor routing across multi-region Kubernetes clusters, driving a 38% reduction in cross-node communication overhead.",
      "Engineered a distributed in-memory cache indexing layer serving low-latency KV lookups for model alignment inference steps.",
      "Authored the RFC and led migration to a zero-trust WireGuard mesh topology across high-bandwidth InfiniBand clusters.",
    ],
  },
];
