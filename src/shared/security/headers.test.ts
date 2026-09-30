import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, isProtectedPath, SECURITY_HEADERS } from "./headers";

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
