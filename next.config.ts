import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    proxyClientMaxBodySize: "50mb",
  },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
