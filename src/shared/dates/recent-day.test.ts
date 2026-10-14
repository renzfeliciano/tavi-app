import { describe, expect, it } from "vitest";
import { formatCalendarDate } from "./calendar";
import { recentDay } from "./recent-day";

describe("recentDay", () => {
  const today = "2026-10-14";
  const when = (on: string) => recentDay(on, today, "en-PH");

  it("says today and yesterday in words", () => {
    expect(when("2026-10-14")).toBe("Today");
    expect(when("2026-10-13")).toBe("Yesterday");
  });

  it("counts days back for the rest of the week", () => {
    expect(when("2026-10-12")).toBe("2 days ago");
    expect(when("2026-10-08")).toBe("6 days ago");
  });

  it("gives the date from a week back, which doesn't go stale as the page ages", () => {
    expect(when("2026-10-07")).toBe(formatCalendarDate("2026-10-07", "en-PH"));
    expect(when("2025-01-03")).toBe(formatCalendarDate("2025-01-03", "en-PH"));
  });

  it("gives the date itself for a day that is still ahead: it did not happen today", () => {
    expect(when("2026-10-15")).toBe(formatCalendarDate("2026-10-15", "en-PH"));
    expect(when("2027-01-02")).toBe(formatCalendarDate("2027-01-02", "en-PH"));
  });
});
