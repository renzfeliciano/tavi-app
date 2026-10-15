import { describe, expect, it } from "vitest";
import {
  advancePast,
  firstRunOn,
  isFinished,
  nextRunOn,
  parseRecurrence,
  RECURRENCE_LIMITS,
  type Recurrence,
  recurrenceLabel,
} from "./recurrence";

const monthly = (anchorDay: number): Recurrence => ({
  frequency: "monthly",
  anchorDay,
  anchorMonth: null,
});
const quarterly = (anchorDay: number): Recurrence => ({
  frequency: "quarterly",
  anchorDay,
  anchorMonth: null,
});
const yearly = (anchorDay: number, anchorMonth: number): Recurrence => ({
  frequency: "yearly",
  anchorDay,
  anchorMonth,
});
const weekly = (anchorDay: number): Recurrence => ({
  frequency: "weekly",
  anchorDay,
  anchorMonth: null,
});

describe("nextRunOn", () => {
  it("steps a monthly schedule on the 31st to the last day of shorter months", () => {
    const rule = monthly(31);
    expect(nextRunOn(rule, "2026-01-31")).toBe("2026-02-28");
    expect(nextRunOn(rule, "2026-02-28")).toBe("2026-03-31");
    expect(nextRunOn(rule, "2026-03-31")).toBe("2026-04-30");
  });

  it("uses 29 February in a leap year", () => {
    expect(nextRunOn(monthly(31), "2028-01-31")).toBe("2028-02-29");
  });

  it("keeps a monthly schedule on its day when the date given is before it in the month", () => {
    expect(nextRunOn(monthly(15), "2026-10-03")).toBe("2026-10-15");
    expect(nextRunOn(monthly(15), "2026-10-15")).toBe("2026-11-15");
  });

  it("steps a quarterly schedule three months at a time", () => {
    const rule = quarterly(15);
    expect(nextRunOn(rule, "2026-01-15")).toBe("2026-04-15");
    expect(nextRunOn(rule, "2026-04-15")).toBe("2026-07-15");
    expect(nextRunOn(rule, "2026-07-15")).toBe("2026-10-15");
    expect(nextRunOn(rule, "2026-10-15")).toBe("2027-01-15");
  });

  it("moves a yearly 29 February to the 28th in a year without one", () => {
    const rule = yearly(29, 2);
    expect(nextRunOn(rule, "2026-02-28")).toBe("2027-02-28");
    expect(nextRunOn(rule, "2027-02-28")).toBe("2028-02-29");
  });

  it("moves a weekly schedule on to the same weekday a week later (Monday is 1)", () => {
    expect(nextRunOn(weekly(1), "2026-10-12")).toBe("2026-10-19");
    expect(nextRunOn(weekly(1), "2026-10-14")).toBe("2026-10-19");
    expect(nextRunOn(weekly(7), "2026-10-14")).toBe("2026-10-18");
  });
});

describe("firstRunOn", () => {
  it("is the start date itself when it is a due date", () => {
    expect(firstRunOn(monthly(15), "2026-11-15")).toBe("2026-11-15");
    expect(firstRunOn(weekly(1), "2026-10-12")).toBe("2026-10-12");
    expect(firstRunOn(yearly(1, 11), "2026-11-01")).toBe("2026-11-01");
  });

  it("is the next due date when the start date is not one", () => {
    expect(firstRunOn(monthly(15), "2026-11-16")).toBe("2026-12-15");
    expect(firstRunOn(weekly(1), "2026-10-14")).toBe("2026-10-19");
    expect(firstRunOn(yearly(1, 3), "2026-11-01")).toBe("2027-03-01");
  });

  it("starts a quarterly schedule in the month of the first due date", () => {
    expect(firstRunOn(quarterly(15), "2026-11-10")).toBe("2026-11-15");
    expect(firstRunOn(quarterly(15), "2026-11-20")).toBe("2026-12-15");
  });
});

describe("advancePast", () => {
  it("returns the latest due date that has come and the one after today", () => {
    expect(advancePast(monthly(1), "2026-11-01", "2027-02-10")).toEqual({
      latest: "2027-02-01",
      next: "2027-03-01",
    });
  });

  it("returns the due date itself when only it has come", () => {
    expect(advancePast(monthly(1), "2026-11-01", "2026-11-01")).toEqual({
      latest: "2026-11-01",
      next: "2026-12-01",
    });
  });

  it("keeps a quarterly schedule's months after a long gap", () => {
    expect(advancePast(quarterly(15), "2026-01-15", "2026-11-01")).toEqual({
      latest: "2026-10-15",
      next: "2027-01-15",
    });
  });
});

describe("parseRecurrence", () => {
  const today = "2026-10-14";
  const valid = {
    frequency: "monthly",
    anchorDay: "15",
    startOn: "2026-11-01",
  };

  it("accepts a monthly schedule and reads text numbers", () => {
    expect(parseRecurrence(valid, { today })).toEqual({
      ok: true,
      rule: { frequency: "monthly", anchorDay: 15, anchorMonth: null },
      startOn: "2026-11-01",
      endsOn: null,
      maxDrafts: null,
    });
  });

  it("accepts today as the start date", () => {
    expect(parseRecurrence({ ...valid, startOn: today }, { today }).ok).toBe(
      true,
    );
  });

  it("rejects a start date before today", () => {
    expect(
      parseRecurrence({ ...valid, startOn: "2026-10-13" }, { today }),
    ).toEqual({
      ok: false,
      errors: { startOn: "Choose a start date from today on." },
    });
  });

  it("rejects a day outside the range for the frequency", () => {
    expect(
      parseRecurrence({ ...valid, anchorDay: "32" }, { today }),
    ).toMatchObject({ ok: false, errors: { anchorDay: expect.any(String) } });
    expect(
      parseRecurrence({ ...valid, anchorDay: "0" }, { today }),
    ).toMatchObject({ ok: false, errors: { anchorDay: expect.any(String) } });
    expect(
      parseRecurrence(
        { ...valid, frequency: "weekly", anchorDay: "8" },
        { today },
      ),
    ).toMatchObject({ ok: false, errors: { anchorDay: expect.any(String) } });
  });

  it("rejects an end date before the start", () => {
    expect(
      parseRecurrence({ ...valid, endsOn: "2026-10-31" }, { today }),
    ).toMatchObject({ ok: false, errors: { endsOn: expect.any(String) } });
  });

  it("rejects a number of statements of 0 or above the limit", () => {
    expect(
      parseRecurrence({ ...valid, maxDrafts: "0" }, { today }),
    ).toMatchObject({ ok: false, errors: { maxDrafts: expect.any(String) } });
    expect(
      parseRecurrence(
        { ...valid, maxDrafts: String(RECURRENCE_LIMITS.maxDraftsMax + 1) },
        { today },
      ),
    ).toMatchObject({
      ok: false,
      errors: { maxDrafts: expect.any(String) },
    });
    expect(
      parseRecurrence({ ...valid, maxDrafts: "12" }, { today }),
    ).toMatchObject({ ok: true, maxDrafts: 12 });
  });

  it("requires a month for a yearly schedule", () => {
    expect(
      parseRecurrence({ ...valid, frequency: "yearly" }, { today }),
    ).toMatchObject({ ok: false, errors: { anchorMonth: expect.any(String) } });
    expect(
      parseRecurrence(
        { ...valid, frequency: "yearly", anchorMonth: "3" },
        { today },
      ),
    ).toMatchObject({
      ok: true,
      rule: { frequency: "yearly", anchorDay: 15, anchorMonth: 3 },
    });
  });

  it("rejects an unknown frequency", () => {
    expect(
      parseRecurrence({ ...valid, frequency: "daily" }, { today }),
    ).toMatchObject({ ok: false, errors: { frequency: expect.any(String) } });
  });

  it("treats anything that is not an object as missing fields", () => {
    expect(parseRecurrence(null, { today })).toMatchObject({ ok: false });
  });
});

describe("isFinished", () => {
  const open = { endsOn: null, maxDrafts: null, draftsCreated: 5 };

  it("is false for a schedule with no end", () => {
    expect(isFinished(open, "2030-01-01")).toBe(false);
  });

  it("is true once the number of statements is reached", () => {
    expect(isFinished({ ...open, maxDrafts: 5 }, "2026-12-01")).toBe(true);
    expect(isFinished({ ...open, maxDrafts: 6 }, "2026-12-01")).toBe(false);
  });

  it("is true when the next due date is after the end date", () => {
    expect(isFinished({ ...open, endsOn: "2026-12-31" }, "2027-01-01")).toBe(
      true,
    );
    expect(isFinished({ ...open, endsOn: "2026-12-31" }, "2026-12-31")).toBe(
      false,
    );
  });
});

describe("recurrenceLabel", () => {
  it("says it in words", () => {
    expect(recurrenceLabel(weekly(1))).toBe("Every week on Monday");
    expect(recurrenceLabel(monthly(15))).toBe("Every month on the 15th");
    expect(recurrenceLabel(monthly(31))).toBe(
      "Every month on the 31st (the last day in shorter months)",
    );
    expect(recurrenceLabel(quarterly(1))).toBe("Every 3 months on the 1st");
    expect(recurrenceLabel(yearly(2, 3))).toBe("Every year on 2 March");
  });
});
