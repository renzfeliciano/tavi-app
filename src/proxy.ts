import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

// Optimistic check only (§D): no session cookie → go to sign-in, without a
// round trip to the database. The real check is requireOrgContext() in the
// app layout and every server action, since a cookie can be stale or forged.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request, { cookiePrefix: "tavi" })) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/quotes/:path*",
    "/invoices/:path*",
    "/payments/:path*",
    "/customers/:path*",
    "/catalog/:path*",
    "/settings/:path*",
    "/onboarding",
  ],
};
