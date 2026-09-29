import type { NextConfig } from "next";

// Security headers and CSP are added in Phase 0.5 (docs/foundation-proposal.md §I).
const nextConfig: NextConfig = {
  poweredByHeader: false,
  typedRoutes: true,
};

export default nextConfig;
