import type { Project } from "@/lib/types";

/**
 * TODO: PLACEHOLDER — the backend has no projects endpoint.
 *
 * The API exposes Authors, Posts and Media only; Posts are blog entries, not
 * portfolio works, so they are deliberately not reused here. Replace with a
 * `getProjects()` loader when `/projects` ships.
 *
 * Technology/language labels are deliberately absent: the cards, the preview
 * banner and the catalog all describe projects by what they do, not by what
 * they are written in.
 *
 * Note this is the single source for both the carousel and the expanded
 * catalog grid — the original mock listed five projects in the carousel and a
 * different six in the grid, which meant "Vesper Wire Protocol" was
 * unreachable from the carousel and the two views could drift apart.
 */
export const projectsPlaceholder: Project[] = [
  {
    index: "01",
    category: "VECTOR CORE",
    title: "Aether Engine",
    description:
      "Sub-millisecond distributed vector indexer engineered for billion-scale embeddings. Features custom SIMD-accelerated HNSW traversal, memory-mapped zero-copy deserialization, and leaderless cluster replication.",
    summary:
      "Sub-millisecond distributed vector database written in Rust for real-time semantic retrieval at billion-embedding scale.",
    domain: "Vector Storage",
    year: "2024",
    metrics: [
      { label: "Latency p99", value: "<1.8ms" },
      { label: "Throughput", value: "45k QPS/node" },
    ],
    previewUrl: "https://aether.cluster.internal:9080/metrics",
    stats: [
      { label: "Query P99", value: "1.42 ms", fill: 28, tone: "positive" },
      { label: "HNSW Graph Depth", value: "16 Layers", fill: 64, tone: "accent" },
      { label: "Memory Allocation", value: "Zero Copy", fill: 15, tone: "neutral" },
    ],
    thumbnail: "vector",
    thumbnailFooter: { left: "<1.8ms Query", right: "SIMD Active", highlight: true },
    links: { repo: "https://github.com", demo: "#", spec: "#" },
  },
  {
    index: "02",
    category: "CREATIVE TOOL",
    title: "Chronos Studio",
    description:
      "Collaborative shader workbench running natively in WebAssembly with real-time state synchronization over peer-to-peer WebRTC channels using Automerge CRDTs.",
    summary:
      "Collaborative GLSL shader workbench running in WebAssembly with real-time state synchronization via Automerge CRDTs.",
    domain: "Shader Tooling",
    year: "2024",
    metrics: [
      { label: "Frame rate", value: "60 FPS Flat" },
      { label: "Transport", value: "P2P WebRTC" },
    ],
    previewUrl: "https://chronos.studio.local:4000/glsl/live",
    stats: [
      { label: "Frame Rate", value: "60.0 FPS", fill: 96, tone: "positive" },
      { label: "Connected Peers", value: "12 Peers", fill: 48, tone: "accent" },
      { label: "CRDT Sync", value: "0.4 ms", fill: 12, tone: "neutral" },
    ],
    thumbnail: "shader",
    thumbnailFooter: { left: "60 FPS Flat", right: "P2P Mesh" },
    links: { repo: "https://github.com", demo: "#", spec: "#" },
  },
  {
    index: "03",
    category: "KERNEL NETWORKING",
    title: "Helios Mesh",
    description:
      "Ultra-light edge proxy and network policy supervisor using kernel-level eBPF packet inspection. Direct packet rewriting without context switches between user and kernel space.",
    summary:
      "Ultra-light edge proxy and network policy supervisor using kernel-level eBPF packet inspection and zero-switch routing.",
    domain: "Network Mesh",
    year: "2023",
    metrics: [
      { label: "Jitter", value: "0.2ms" },
      { label: "Wire rate", value: "100Gbps" },
    ],
    previewUrl: "https://helios.mesh/xdp/flow-monitor",
    stats: [
      { label: "Forwarding Jitter", value: "0.18 ms", fill: 9, tone: "positive" },
      { label: "Availability", value: "99.999%", fill: 100, tone: "accent" },
      { label: "Attach Point", value: "eBPF Hook", fill: 40, tone: "neutral" },
    ],
    thumbnail: "kernel",
    thumbnailFooter: { left: "0.2ms Jitter", right: "Zero Copy" },
    links: { repo: "https://github.com", demo: null, spec: "#" },
  },
  {
    index: "04",
    category: "DESIGN SYSTEM",
    title: "Pulse Design Engine",
    description:
      "Accessible headless component primitives with fluid spring motion physics, zero external dependencies, and strict WCAG 2.1 AAA accessibility conformance.",
    summary:
      "Accessible headless component primitives with fluid spring motion physics, zero external dependencies, and strict a11y.",
    domain: "Design System",
    year: "2023",
    metrics: [
      { label: "Bundle", value: "3.2kb Gzip" },
      { label: "Conformance", value: "100% WCAG AAA" },
    ],
    previewUrl: "https://pulse.system/preview/spring-physics",
    stats: [
      { label: "Bundle Size", value: "3.2 kb", fill: 8, tone: "positive" },
      { label: "WCAG Coverage", value: "100% AAA", fill: 100, tone: "accent" },
      { label: "Dependencies", value: "0 Dep", fill: 4, tone: "neutral" },
    ],
    thumbnail: "kinetic",
    thumbnailFooter: { left: "3.2kb Gzip", right: "WCAG 2.1 AAA", highlight: true },
    links: { repo: "https://github.com", demo: "#", spec: null },
  },
  {
    index: "05",
    category: "EMBEDDED ENGINE",
    title: "Kestrel Log DB",
    description:
      "Embedded LSM-tree storage engine optimized for micro-controllers and resource-constrained edge hardware. Features deterministic compaction trees and zero fragmentation.",
    summary:
      "Embedded log-structured merge tree storage engine tailored for resource-constrained edge hardware and fast writes.",
    domain: "Embedded KV",
    year: "2022",
    metrics: [
      { label: "Footprint", value: "<4MB RAM" },
      { label: "Allocation", value: "Zero Allocation" },
    ],
    previewUrl: "https://kestrel.edge/node-storage/lsm",
    stats: [
      { label: "Resident Memory", value: "3.8 MB", fill: 19, tone: "positive" },
      { label: "Write Throughput", value: "100k IOPS", fill: 72, tone: "accent" },
      { label: "Journal Mode", value: "Append Only", fill: 30, tone: "neutral" },
    ],
    thumbnail: "lsm",
    thumbnailFooter: { left: "<4MB RAM", right: "LSM Tree" },
    links: { repo: "https://github.com", demo: null, spec: "#" },
  },
  {
    index: "06",
    category: "PROTOCOL",
    title: "Vesper Wire Protocol",
    description:
      "Binary RPC wire serialization schema designed for minimal payload footprints over unreliable satellite and mobile edge connections, with deterministic framing and forward-compatible field elision.",
    summary:
      "Binary RPC wire serialization schema designed for minimal payload footprints over unreliable satellite and mobile edge links.",
    domain: "Wire Format",
    year: "2022",
    metrics: [
      { label: "Overhead", value: "11 bytes" },
      { label: "Transport", value: "QUIC / DTLS" },
    ],
    previewUrl: "https://vesper.proto/inspect/frame-trace",
    stats: [
      { label: "Frame Overhead", value: "11 B", fill: 11, tone: "positive" },
      { label: "Loss Tolerance", value: "18%", fill: 55, tone: "accent" },
      { label: "Handshake", value: "0-RTT", fill: 10, tone: "neutral" },
    ],
    thumbnail: "wire",
    thumbnailFooter: { left: "11B Overhead", right: "0-RTT" },
    links: { repo: "https://github.com", demo: null, spec: "#" },
  },
];
