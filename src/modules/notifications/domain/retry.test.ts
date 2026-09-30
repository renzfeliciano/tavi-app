import { describe, expect, it } from "vitest";
import { MAX_ATTEMPTS, nextAttemptAt } from "./retry";

const now = new Date("2026-09-30T00:00:00Z");
const minutes = (n: number) => new Date(now.getTime() + n * 60_000);

describe("outbox retry schedule", () => {
  it("backs off 1 min, 5 min, 30 min, 2 h, 12 h", () => {
    expect([1, 2, 3, 4, 5].map((attempt) => nextAttemptAt(attempt, now))).toEqual([
      minutes(1),
      minutes(5),
      minutes(30),
      minutes(120),
      minutes(720),
    ]);
  });

  it("gives up after the sixth failed attempt", () => {
    expect(MAX_ATTEMPTS).toBe(6);
    expect(nextAttemptAt(6, now)).toBeNull();
  });
});
