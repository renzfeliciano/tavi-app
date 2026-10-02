import { describe, expect, it } from "vitest";
import { AGING_BUCKETS, agingBucket, daysOverdue } from "./aging";

describe("agingBucket", () => {
  const today = "2026-10-02";

  it.each([
    ["2026-10-30", "current", 0],
    ["2026-10-02", "current", 0],
    ["2026-10-01", "1-30", 1],
    ["2026-09-02", "1-30", 30],
    ["2026-09-01", "31-60", 31],
    ["2026-08-03", "31-60", 60],
    ["2026-08-02", "61-90", 61],
    ["2026-07-04", "61-90", 90],
    ["2026-07-03", "over-90", 91],
    ["2025-01-01", "over-90", 639],
  ] as const)("a bill due %s is %s (%i days overdue)", (dueDate, bucket, days) => {
    expect(daysOverdue(dueDate, today)).toBe(days);
    expect(agingBucket(dueDate, today)).toBe(bucket);
  });

  it("orders the buckets from not yet due to longest overdue", () => {
    expect(AGING_BUCKETS.map((b) => b.key)).toEqual(["current", "1-30", "31-60", "61-90", "over-90"]);
  });
});
