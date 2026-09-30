import type { NextConfig } from "next";
import { PORTAL_HEADERS, PORTAL_PATH_PATTERNS, SECURITY_HEADERS } from "./src/shared/security/headers";

// The per-request Content-Security-Policy (with its nonce) is set in
// src/proxy.ts; the static hardening headers apply to every response here.
const nextConfig: NextConfig = {
  // E2E runs its own server next to your dev server; Next.js allows one dev
  // server per build directory, so it gets its own (see playwright.config.ts).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  typedRoutes: true,
  // Dev-only badge; bottom-left would cover Settings and the Home tab.
  devIndicators: { position: "top-right" },
  experimental: {
    // Logo uploads are up to 2 MB (the files module rejects anything larger).
    serverActions: { bodySizeLimit: "3mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // Later entries win for the same header: portal pages tighten Referrer-Policy.
      ...PORTAL_PATH_PATTERNS.map((source) => ({ source, headers: PORTAL_HEADERS })),
    ];
  },
};

export default nextConfig;
