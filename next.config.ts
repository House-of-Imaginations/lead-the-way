import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // A stray lockfile in the home directory makes Turbopack infer ~/ as the
  // workspace root, and Tailwind's source detection follows it. Pin the root.
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
  // Otherwise `next dev` appends an agent rules block to AGENTS.md on every run.
  agentRules: false,
  // R13: the dev indicator sat over the side nav disclaimer. Dev only.
  devIndicators: false,
};

export default nextConfig;
