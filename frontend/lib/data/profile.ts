import type { Profile } from "@/lib/types";

/**
 * TODO: PLACEHOLDER — most of this is not covered by the backend API.
 *
 * `AuthorDto` supplies only `name`, `email`, `avatarUrl` and `biography`; those
 * four are overlaid at request time by `getProfile()` in `lib/portfolio.ts`.
 * Everything else below (title, location, timezone, availability, socials,
 * repositories, colophon) has no endpoint yet and is hardcoded. Extend
 * `AuthorDto` on the backend and widen the overlay in `getProfile()` to replace
 * these — no component changes required.
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
  ],
  email: "alex.vance.dev@gmail.com",
  location: "San Francisco, CA (Hybrid)",
  timezoneLabel: "SF / PST",
  timezone: "UTC -8 (PST)",
  availability: "Open for Staff roles & select advisory",
  advisoryNote: "Available for Q2/Q3 2025 Advisory",
  focus: "Primary focus: Systems / C++ / Rust",
  year: "2025",
  socials: [
    {
      label: "github.com/avance",
      footerLabel: "GitHub (@avance)",
      href: "https://github.com",
      icon: "github",
    },
    {
      label: "linkedin.com/in/alexvance",
      footerLabel: "LinkedIn (/in/alexvance)",
      href: "https://linkedin.com",
      icon: "linkedin",
    },
    {
      label: "x.com/avance_eng",
      footerLabel: "X / Twitter (@avance_eng)",
      href: "https://x.com",
      icon: "x",
    },
  ],
  footerBio:
    "Staff Software & Distributed Systems Engineer based in San Francisco. Building deterministic low-latency software with tactile craftsmanship and quiet elegance.",
  contactPitch:
    "Currently discussing principal/staff infrastructure roles, technical advisory engagements, and open source runtime architectures.",
  repositories: [
    { name: "aether-core-db", href: "https://github.com" },
    { name: "chronos-crdt-wasm", href: "https://github.com" },
    { name: "helios-ebpf-mesh", href: "https://github.com" },
    { name: "kestrel-lsm-storage", href: "https://github.com" },
  ],
  colophon: "Typeset in Newsreader & JetBrains Mono.",
};
