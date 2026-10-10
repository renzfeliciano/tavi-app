import { describe, expect, it } from "vitest";
import { parseReportPeriod, presetPeriod, previousPeriod, REPORT_LIMITS } from "./period";

const today = "2026-10-02";

describe("presetPeriod", () => {
  it.each([
    ["this-month", "2026-10-01", "2026-10-31"],
    ["last-month", "2026-09-01", "2026-09-30"],
    ["this-quarter", "2026-10-01", "2026-12-31"],
    ["last-quarter", "2026-07-01", "2026-09-30"],
    ["this-year", "2026-01-01", "2026-12-31"],
    ["last-year", "2025-01-01", "2025-12-31"],
  ] as const)("%s runs from %s to %s", (preset, from, to) => {
    expect(presetPeriod(preset, today)).toEqual({ preset, from, to });
  });

  it("reaches back into the previous year in January", () => {
    expect(presetPeriod("last-month", "2027-01-15")).toEqual({ preset: "last-month", from: "2026-12-01", to: "2026-12-31" });
    expect(presetPeriod("last-quarter", "2027-02-10")).toEqual({
      preset: "last-quarter",
      from: "2026-10-01",
      to: "2026-12-31",
    });
  });

  it("ends each month on its last day, leap years included", () => {
    expect(presetPeriod("this-month", "2028-02-10").to).toBe("2028-02-29");
    expect(presetPeriod("this-month", "2027-02-10").to).toBe("2027-02-28");
    expect(presetPeriod("last-month", "2026-05-31")).toEqual({ preset: "last-month", from: "2026-04-01", to: "2026-04-30" });
  });
});

describe("parseReportPeriod", () => {
  const thisMonth = { preset: "this-month", from: "2026-10-01", to: "2026-10-31" };

  it("defaults to this month", () => {
    expect(parseReportPeriod({}, today)).toEqual({ period: thisMonth, error: null });
  });

  it("reads a preset, or ignores one it doesn't know", () => {
    expect(parseReportPeriod({ period: "last-quarter" }, today).period).toEqual({
      preset: "last-quarter",
      from: "2026-07-01",
      to: "2026-09-30",
    });
    expect(parseReportPeriod({ period: "next-decade" }, today)).toEqual({ period: thisMonth, error: null });
  });

  it("reads custom dates, and recognises a range that matches a preset", () => {
    expect(parseReportPeriod({ from: "2026-08-15", to: "2026-09-14" }, today)).toEqual({
      period: { preset: null, from: "2026-08-15", to: "2026-09-14" },
      error: null,
    });
    expect(parseReportPeriod({ from: "2026-07-01", to: "2026-09-30" }, today).period.preset).toBe("last-quarter");
  });

  it(`allows up to ${REPORT_LIMITS.maxDays} days, counting both ends`, () => {
    // 2028 is a leap year: 1 January to 31 December is 366 days.
    expect(parseReportPeriod({ from: "2028-01-01", to: "2028-12-31" }, today).error).toBeNull();
    expect(parseReportPeriod({ from: "2028-01-01", to: "2029-01-01" }, today)).toEqual({
      period: thisMonth,
      error: `Choose a period of ${REPORT_LIMITS.maxDays} days or less.`,
    });
  });

  it("explains dates it can't use, and shows this month instead", () => {
    expect(parseReportPeriod({ from: "2026-09-30", to: "2026-09-01" }, today)).toEqual({
      period: thisMonth,
      error: "Choose an end date on or after the start date.",
    });
    expect(parseReportPeriod({ from: "2026-02-30", to: "2026-03-10" }, today).error).toBe("Choose real dates for the period.");
    expect(parseReportPeriod({ from: "2026-09-01" }, today).error).toBe("Choose both a start and an end date.");
  });

  it("takes the first of a repeated parameter", () => {
    expect(parseReportPeriod({ period: ["last-month", "this-year"] }, today).period.preset).toBe("last-month");
  });
});

describe("previousPeriod", () => {
  it("steps whole calendar months back by their own length", () => {
    expect(previousPeriod({ preset: null, from: "2026-03-01", to: "2026-03-31" })).toEqual({
      preset: null,
      from: "2026-02-01",
      to: "2026-02-28",
    });
    expect(previousPeriod({ preset: null, from: "2026-07-01", to: "2026-09-30" })).toMatchObject({
      from: "2026-04-01",
      to: "2026-06-30",
    });
    expect(previousPeriod({ preset: null, from: "2026-01-01", to: "2026-12-31" })).toMatchObject({
      from: "2025-01-01",
      to: "2025-12-31",
    });
  });

  it("crosses the year boundary", () => {
    expect(previousPeriod({ preset: null, from: "2026-01-01", to: "2026-01-31" })).toMatchObject({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });

  it("uses the same number of days for any other range", () => {
    expect(previousPeriod({ preset: null, from: "2026-08-15", to: "2026-09-14" })).toMatchObject({
      from: "2026-07-15",
      to: "2026-08-14",
    });
  });
});
