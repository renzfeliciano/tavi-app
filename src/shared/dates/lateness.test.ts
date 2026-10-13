import { describe, expect, it } from "vitest";
import { daysLate, lateLabel } from "./lateness";

describe("daysLate", () => {
  it("counts the whole days since the due date", () => {
    expect(daysLate("2026-10-01", "2026-10-12")).toBe(11);
    expect(daysLate("2026-10-11", "2026-10-12")).toBe(1);
  });

  it("is zero on the due date and before it: not late yet", () => {
    expect(daysLate("2026-10-12", "2026-10-12")).toBe(0);
    expect(daysLate("2026-10-20", "2026-10-12")).toBe(0);
  });

  it("counts across month and year ends", () => {
    expect(daysLate("2026-12-30", "2027-01-02")).toBe(3);
  });
});

describe("lateLabel", () => {
  it("says how late in plain words", () => {
    expect(lateLabel(1)).toBe("1 day late");
    expect(lateLabel(11)).toBe("11 days late");
  });
});
