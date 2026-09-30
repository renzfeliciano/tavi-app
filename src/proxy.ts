import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { buildContentSecurityPolicy, isProtectedPath } from "@/shared/security/headers";

// Runs before every page request:
// 1. Optimistic auth check (§D): no session cookie on a protected path → sign
//    in, without touching the database. The real check is requireOrgContext()
//    in the app layout and in every server action.
// 2. A fresh CSP nonce per request (§I). Next.js reads it from the request's
//    CSP header and stamps it on its own scripts.
// 3. A request ID for correlating logs.
export function proxy(request: NextRequest) {
  if (
    isProtectedPath(request.nextUrl.pathname) &&
    !getSessionCookie(request, { cookiePrefix: "tavi" })
  ) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildContentSecurityPolicy({
    nonce,
    dev: process.env.NODE_ENV === "development",
    https: request.nextUrl.protocol === "https:",
  });
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: [
    {
      // Every page; not API routes, static assets or link prefetches.
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
