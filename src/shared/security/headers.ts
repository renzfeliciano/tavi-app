// HTTP security headers (docs/foundation-proposal.md §I). Pure, so they can be
// unit-tested; proxy.ts applies the per-request CSP, next.config.ts the rest.

export type CspOptions = {
  /** Fresh, unguessable value per request (proxy.ts). */
  nonce: string;
  /** Development needs eval (React's error overlays) and the HMR websocket. */
  dev: boolean;
  /** Only ask browsers to upgrade subresources when we're actually on https. */
  https: boolean;
};

/**
 * Strict, nonce-based script policy: only scripts carrying this request's
 * nonce (and what they load) run. Inline style *attributes* are allowed; we
 * use them for computed sizes, and injected CSS is far less dangerous than
 * injected script, which stays locked down.
 */
export function buildContentSecurityPolicy({ nonce, dev, https }: CspOptions): string {
  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "blob:", "data:"]],
    ["font-src", ["'self'"]],
    ["connect-src", ["'self'", ...(dev ? ["ws:"] : [])]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
  ];
  if (https) directives.push(["upgrade-insecure-requests", []]);
  return directives.map(([name, values]) => [name, ...values].join(" ")).join("; ");
}

/** Static hardening headers, applied to every response via next.config.ts. */
export const SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

/**
 * Customer pages (/q/… quotes, /i/… invoices) and team invitations (/invite/…)
 * carry a token in the URL, so they never leak it in a Referer, are never
 * cached and are never indexed (§I).
 */
export const PORTAL_PATH_PATTERNS = ["/q/:path*", "/i/:path*", "/invite/:path*"];
export const PORTAL_HEADERS: { key: string; value: string }[] = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cache-Control", value: "private, no-store" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/quotes",
  "/invoices",
  "/payments",
  "/customers",
  "/catalog",
  "/settings",
  "/onboarding",
];

/** Paths that need a session; proxy.ts redirects to sign-in when there's no cookie. */
export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Longest incoming `x-request-id` we keep (UUIDs and Vercel IDs are far shorter). */
export const REQUEST_ID_MAX_LENGTH = 128;
const REQUEST_ID = new RegExp(`^[A-Za-z0-9._:-]{1,${REQUEST_ID_MAX_LENGTH}}$`);

/**
 * An incoming `x-request-id` if it's a short, plain ID; null otherwise (the
 * caller then makes its own). The header comes from the client and is copied
 * into logs and the response, so anything else (line breaks, quotes, markup,
 * kilobytes of text) is dropped rather than trusted (§I, §K).
 */
export function acceptRequestId(value: string | null | undefined): string | null {
  return value && REQUEST_ID.test(value) ? value : null;
}
