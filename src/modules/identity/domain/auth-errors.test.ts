import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./auth-errors";

describe("authErrorMessage", () => {
  it.each([
    ["INVALID_EMAIL_OR_PASSWORD", /email and password don't match/],
    ["USER_ALREADY_EXISTS", /already has a Tavi account/],
    ["USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", /already has a Tavi account/],
    ["PASSWORD_TOO_SHORT", /at least 12 characters/],
    ["PASSWORD_TOO_LONG", /128 characters or fewer/],
    ["PASSWORD_COMPROMISED", /data breach/],
    ["INVALID_EMAIL", /valid email/],
    ["INVALID_TOKEN", /link has expired or was already used/],
  ])("explains %s in plain language", (code, expected) => {
    expect(authErrorMessage({ code })).toMatch(expected);
  });

  it("asks people to wait when they're rate limited", () => {
    expect(authErrorMessage({ status: 429 })).toMatch(/Too many attempts/);
  });

  it("falls back to a calm generic message and never leaks internals", () => {
    const message = authErrorMessage({ code: "SOME_INTERNAL_ERROR", message: "relation users does not exist" });
    expect(message).toBe("Something went wrong on our side. Please try again.");
  });

  it("handles a missing error", () => {
    expect(authErrorMessage(null)).toBe("Something went wrong on our side. Please try again.");
  });
});
