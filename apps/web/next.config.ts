import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@roadmap/core'],
  agentRules: false,
};

export default nextConfig;
