import type { Profile } from "@/lib/types";

/**
 * What the landing page falls back to, field by field.
 *
 * Every one of these is now editable from the studio's profile tab and stored on the
 * author record — `getProfile()` in `lib/portfolio.ts` overlays whatever the API returns
 * on top of this. What survives is the copy for a field the author has not written yet, or
 * for all of them when the API cannot be reached at all, so that the page renders rather
 * than showing a skeleton with somebody's name missing from it.
 */
export const profilePlaceholder: Profile = {
  name: "Alexander Vance",
  title: "Staff Systems & Distributed Infrastructure",
  monogram: "AV",
  handle: "alexander.vance / dev",
  avatarUrl: null,
  headline:
    "Designing high-throughput computing engines, fault-tolerant protocols, and quiet, tactile digital interfaces.",
  biography: [
    "I am a software engineer focused on the intersection of distributed storage systems, deterministic event streams, and minimalist human-computer interaction. Over the past eight years, I have architected systems processing billions of daily operations while ensuring zero data loss and sub-10ms response latencies.",
    "My engineering ethos centers on clarity, minimal dependency chains, and software built with mechanical sympathy. When I'm not tuning memory allocation profiles in Rust or designing consensus algorithms, I advise fast-growing engineering teams on latency optimization and developer tooling ergonomics.",
  ].join("\n\n"),
  email: "alex.vance.dev@gmail.com",
  location: "San Francisco, CA (Hybrid)",
  availability: "Open for Staff roles & select advisory",
  focus: "Primary focus: Systems / C++ / Rust",
  contacts: [],
  footerBio:
    "Staff Software & Distributed Systems Engineer based in San Francisco. Building deterministic low-latency software with tactile craftsmanship and quiet elegance.",
  contactPitch:
    "Currently discussing principal/staff infrastructure roles, technical advisory engagements, and open source runtime architectures.",
  colophon: "Typeset in Newsreader & JetBrains Mono.",
};
