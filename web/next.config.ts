import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // AFWar/ (parent) has its own package-lock.json for the engine/agents/sim
  // workspace; pin the Next workspace root to web/ so it doesn't get confused.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
