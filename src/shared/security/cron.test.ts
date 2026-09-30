import { describe, expect, it } from "vitest";
import { isAuthorizedCronRequest } from "./cron";

const secret = "s".repeat(40);

describe("isAuthorizedCronRequest", () => {
  it("accepts the exact bearer secret", () => {
    expect(isAuthorizedCronRequest(`Bearer ${secret}`, secret)).toBe(true);
  });

  it.each([
    ["no header", null],
    ["wrong secret", `Bearer ${"x".repeat(40)}`],
    ["missing scheme", secret],
    ["prefix of the secret", `Bearer ${secret.slice(0, 20)}`],
  ])("rejects %s", (_label, header) => {
    expect(isAuthorizedCronRequest(header, secret)).toBe(false);
  });

  it("rejects everything when no secret is configured", () => {
    expect(isAuthorizedCronRequest("Bearer ", undefined)).toBe(false);
    expect(isAuthorizedCronRequest("Bearer anything", "")).toBe(false);
  });
});
