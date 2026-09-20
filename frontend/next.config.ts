import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone — a minimal server the Docker image runs without node_modules.
  output: "standalone",
};

export default nextConfig;
