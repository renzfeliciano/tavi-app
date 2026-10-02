import { describe, expect, it } from "vitest";
import { addDays, compareDates, daysBetween, formatCalendarDate, isCalendarDate, todayIn } from "./calendar";

describe("todayIn", () => {
  it("is the business's local date, not the server's", () => {
    // 16:30 UTC on 30 Sep is already 1 Oct in Manila (UTC+8).
    const now = new Date("2026-09-30T16:30:00Z");
    expect(todayIn("Asia/Manila", now)).toBe("2026-10-01");
    expect(todayIn("America/Los_Angeles", now)).toBe("2026-09-30");
  });
});

describe("addDays", () => {
  it("moves across months, years and leap days", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-17", 30)).toBe("2027-01-16");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-10-01", 0)).toBe("2026-10-01");
  });
});

describe("isCalendarDate", () => {
  it.each(["2026-10-01", "2028-02-29"])("accepts %s", (value) => {
    expect(isCalendarDate(value)).toBe(true);
  });

  it.each(["2026-02-30", "2027-02-29", "2026-13-01", "01/10/2026", "", "2026-10-1"])("rejects %j", (value) => {
    expect(isCalendarDate(value)).toBe(false);
  });
});

describe("compareDates", () => {
  it("orders ISO dates", () => {
    expect(compareDates("2026-10-01", "2026-10-02")).toBeLessThan(0);
    expect(compareDates("2026-10-02", "2026-10-02")).toBe(0);
  });
});

describe("formatCalendarDate", () => {
  it("shows a date in the reader's locale without shifting the day", () => {
    expect(formatCalendarDate("2026-10-01", "en-PH")).toBe("Oct 1, 2026");
    expect(formatCalendarDate("2026-10-01", "de-DE")).toBe("01.10.2026");
  });
});

describe("daysBetween", () => {
  it("counts whole days from one date to another", () => {
    expect(daysBetween("2026-10-01", "2026-10-01")).toBe(0);
    expect(daysBetween("2026-10-01", "2026-10-31")).toBe(30);
    expect(daysBetween("2026-10-31", "2026-10-01")).toBe(-30);
  });

  it("crosses months, years and leap days", () => {
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });
});
