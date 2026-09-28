import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // A stray lockfile in the home directory makes Turbopack infer ~/ as the
  // workspace root, and Tailwind's source detection follows it. Pin the root.
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
};

export default nextConfig;
