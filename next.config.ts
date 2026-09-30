import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./src/shared/security/headers";

// The per-request Content-Security-Policy (with its nonce) is set in
// src/proxy.ts; the static hardening headers apply to every response here.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  typedRoutes: true,
  // Dev-only badge; bottom-left would cover Settings and the Home tab.
  devIndicators: { position: "top-right" },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
