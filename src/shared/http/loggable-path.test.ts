import { describe, expect, it } from "vitest";
import { loggablePath } from "./loggable-path";

// Customer links carry their token in the path, and password resets in the
// query string; neither may reach our logs (§I, §K).
describe("loggablePath", () => {
  const token = "Zx9_aB-3".padEnd(43, "k");

  it.each([
    [`/q/${token}`, "/q/[token]"],
    [`/q/${token}/pdf`, "/q/[token]/pdf"],
    [`/i/${token}/receipts/OR-000012/pdf`, "/i/[token]/receipts/OR-000012/pdf"],
    [`/i/${token}?utm=x`, "/i/[token]"],
  ])("hides the token in %s", (path, expected) => expect(loggablePath(path)).toBe(expected));

  it.each([
    ["/reset-password?token=secret", "/reset-password"],
    ["/quotes/0192e4c8-7b1a-7c3e-9f00-000000000001", "/quotes/0192e4c8-7b1a-7c3e-9f00-000000000001"],
    ["/invoices", "/invoices"],
    ["/q", "/q"],
  ])("keeps %s readable without its query", (path, expected) => expect(loggablePath(path)).toBe(expected));
});
