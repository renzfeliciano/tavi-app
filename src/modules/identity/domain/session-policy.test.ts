import { describe, expect, it } from "vitest";
import { isPastAbsoluteLifetime, SESSION_POLICY } from "./session-policy";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-09-30T12:00:00Z");

describe("SESSION_POLICY (docs/foundation-proposal.md §D)", () => {
  it("encodes 7-day idle, daily renewal, 30-day absolute and 15-minute fresh windows", () => {
    expect(SESSION_POLICY).toEqual({
      idleTimeoutSeconds: 7 * 24 * 60 * 60,
      renewAfterSeconds: 24 * 60 * 60,
      absoluteLifetimeSeconds: 30 * 24 * 60 * 60,
      freshAuthSeconds: 15 * 60,
    });
  });
});

describe("isPastAbsoluteLifetime", () => {
  it("keeps a session signed in before 30 days", () => {
    expect(isPastAbsoluteLifetime(new Date(now.getTime() - 29 * DAY), now)).toBe(false);
  });

  it("ends a session at exactly 30 days, however active it was", () => {
    expect(isPastAbsoluteLifetime(new Date(now.getTime() - 30 * DAY), now)).toBe(true);
    expect(isPastAbsoluteLifetime(new Date(now.getTime() - 45 * DAY), now)).toBe(true);
  });

  it("treats a creation time in the future (clock skew) as fresh", () => {
    expect(isPastAbsoluteLifetime(new Date(now.getTime() + DAY), now)).toBe(false);
  });
});
