import { describe, expect, it } from "vitest";
import { clientIdleLimitMs, idleStatus, isPastAbsoluteLifetime, SESSION_POLICY } from "./session-policy";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-09-30T12:00:00Z");

describe("SESSION_POLICY (docs/foundation-proposal.md §D)", () => {
  it("encodes 30-minute idle, 5-minute renewal, 30-day absolute and 15-minute fresh windows (D23)", () => {
    expect(SESSION_POLICY).toEqual({
      idleTimeoutSeconds: 30 * 60,
      renewAfterSeconds: 5 * 60,
      idleWarningSeconds: 60,
      absoluteLifetimeSeconds: 30 * 24 * 60 * 60,
      freshAuthSeconds: 15 * 60,
    });
  });

  it("makes the browser give up before the server can, by the renewal interval", () => {
    expect(clientIdleLimitMs()).toBe(25 * 60 * 1000);
    expect(clientIdleLimitMs()).toBeLessThan(SESSION_POLICY.idleTimeoutSeconds * 1000);
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

describe("idleStatus", () => {
  const limit = 25 * 60 * 1000;
  const warn = 60 * 1000;
  const at = (idleMs: number) => idleStatus({ lastActivityAt: 0, now: idleMs, limitMs: limit, warningMs: warn });

  it("is active while the person is around", () => {
    expect(at(0)).toEqual({ status: "active" });
    expect(at(limit - warn - 1)).toEqual({ status: "active" });
  });

  it("warns for the last minute, counting down", () => {
    expect(at(limit - warn)).toEqual({ status: "warning", remainingMs: warn });
    expect(at(limit - 1_000)).toEqual({ status: "warning", remainingMs: 1_000 });
  });

  it("expires at the limit and stays expired", () => {
    expect(at(limit)).toEqual({ status: "expired" });
    expect(at(limit * 3)).toEqual({ status: "expired" });
  });

  it("treats a clock that went backwards as activity", () => {
    expect(idleStatus({ lastActivityAt: 10_000, now: 5_000, limitMs: limit, warningMs: warn })).toEqual({ status: "active" });
  });
});
