import { describe, expect, it } from "vitest";
import {
  acceptRequestId,
  buildContentSecurityPolicy,
  isProtectedPath,
  SECURITY_HEADERS,
  PORTAL_HEADERS,
  PORTAL_PATH_PATTERNS,
} from "./headers";

const directives = (csp: string) =>
  Object.fromEntries(
    csp
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name, ...values] = d.split(/\s+/);
        return [name, values];
      }),
  );

describe("buildContentSecurityPolicy", () => {
  const prod = directives(buildContentSecurityPolicy({ nonce: "abc123", dev: false, https: true }));

  it("only runs scripts carrying this request's nonce", () => {
    expect(prod["script-src"]).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
  });

  it("never allows eval or inline scripts in production", () => {
    expect(prod["script-src"]).not.toContain("'unsafe-eval'");
    expect(prod["script-src"]).not.toContain("'unsafe-inline'");
  });

  it("locks down framing, plugins, base URLs and form targets", () => {
    expect(prod["frame-ancestors"]).toEqual(["'none'"]);
    expect(prod["object-src"]).toEqual(["'none'"]);
    expect(prod["base-uri"]).toEqual(["'self'"]);
    expect(prod["form-action"]).toEqual(["'self'"]);
    expect(prod["default-src"]).toEqual(["'self'"]);
  });

  it("upgrades insecure requests only when served over https", () => {
    expect(prod).toHaveProperty("upgrade-insecure-requests");
    const local = directives(buildContentSecurityPolicy({ nonce: "n", dev: false, https: false }));
    expect(local).not.toHaveProperty("upgrade-insecure-requests");
  });

  it("allows eval and the HMR websocket only in development", () => {
    const dev = directives(buildContentSecurityPolicy({ nonce: "n", dev: true, https: false }));
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["connect-src"]).toContain("ws:");
    expect(prod["connect-src"]).toEqual(["'self'"]);
  });
});

describe("SECURITY_HEADERS", () => {
  const byKey = Object.fromEntries(SECURITY_HEADERS.map((h) => [h.key, h.value]));

  it("sets the baseline hardening headers (§I)", () => {
    expect(byKey["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains; preload");
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(byKey["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(byKey["Permissions-Policy"]).toContain("camera=()");
  });
});

describe("PORTAL_HEADERS", () => {
  it("keeps customer links out of referrers, caches and search engines (§I)", () => {
    expect(Object.fromEntries(PORTAL_HEADERS.map((h) => [h.key, h.value]))).toEqual({
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    });
  });

  it("applies to the customer pages only", () => {
    expect(PORTAL_PATH_PATTERNS).toEqual(["/q/:path*", "/i/:path*"]);
    expect(isProtectedPath("/q/abc")).toBe(false);
    expect(isProtectedPath("/i/abc")).toBe(false);
  });
});

describe("isProtectedPath", () => {
  it.each(["/dashboard", "/quotes", "/quotes/new", "/settings/security", "/onboarding"])(
    "%s needs a session",
    (path) => expect(isProtectedPath(path)).toBe(true),
  );

  it.each(["/", "/sign-in", "/sign-up", "/reset-password", "/quotes-public", "/api/health"])(
    "%s is public",
    (path) => expect(isProtectedPath(path)).toBe(false),
  );
});

// x-request-id comes from whoever sent the request; it ends up in logs and
// response headers, so only short, plain IDs are kept (§K, §I).
describe("acceptRequestId", () => {
  it.each(["0b9e5c1a-7f2d-4c1e-9a7b-3d2f1e0c9b8a", "iad1::abcde-1727790000000-1a2b3c", "req_123.4"])(
    "keeps %s",
    (id) => expect(acceptRequestId(id)).toBe(id),
  );

  it.each([
    ["missing", null],
    ["empty", ""],
    ["too long", "a".repeat(129)],
    ["a line break (log forging)", "abc\nlevel=error msg=forged"],
    ["spaces and quotes", 'abc" injected'],
    ["markup", "<script>"],
  ])("drops one that is %s", (_label, id) => expect(acceptRequestId(id)).toBeNull());
});
