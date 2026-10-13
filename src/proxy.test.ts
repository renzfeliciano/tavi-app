import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

const at = (path: string, init?: ConstructorParameters<typeof NextRequest>[1]) =>
  new NextRequest(new URL(path, "https://app.example"), init);

afterEach(() => vi.unstubAllEnvs());

describe("proxy", () => {
  it("sends a signed-out visitor to sign in, whichever page of the app they ask for", () => {
    const response = proxy(at("/reports"));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/sign-in");
  });

  it("lets a request with a session cookie through, with a fresh CSP and request ID", () => {
    const response = proxy(at("/reports", { headers: { cookie: "tavi.session_token=x" } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toMatch(/nonce-/);
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  // The /dev pages (design system, modal samples) are for the developer's machine.
  // Each one also checks NODE_ENV itself, but a page that streams has already sent
  // "200 OK" by then; here a production visitor gets a plain 404 before any page runs.
  it("answers 404 for the developer pages in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const path of ["/dev", "/dev/design", "/dev/modals?sample=danger"]) {
      expect(proxy(at(path)).status).toBe(404);
    }
  });

  it("leaves the developer pages alone in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(proxy(at("/dev/design")).status).toBe(200);
  });

  it("does not mistake a page that merely starts with /dev for a developer page", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(proxy(at("/devices")).status).toBe(200);
  });
});
