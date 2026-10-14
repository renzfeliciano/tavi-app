import { describe, expect, it } from "vitest";
import { parseWithholdingQuarter } from "./withholding-quarter";

describe("parseWithholdingQuarter", () => {
  it("reads a year and a quarter", () => {
    expect(parseWithholdingQuarter("2026", "3", "2026-10-14")).toEqual({ ok: true, year: 2026, quarter: 3 });
    expect(parseWithholdingQuarter("2025", "4", "2026-10-14")).toEqual({ ok: true, year: 2025, quarter: 4 });
  });

  it("uses the current quarter, in the business's own day, when both are missing", () => {
    expect(parseWithholdingQuarter(null, null, "2026-10-14")).toEqual({ ok: true, year: 2026, quarter: 4 });
    expect(parseWithholdingQuarter(null, null, "2027-01-01")).toEqual({ ok: true, year: 2027, quarter: 1 });
    expect(parseWithholdingQuarter("", "", "2026-03-31")).toEqual({ ok: true, year: 2026, quarter: 1 });
  });

  it("refuses a quarter that isn't 1 to 4", () => {
    for (const quarter of ["0", "5", "-1", "1.5", "Q3", "abc", " "]) {
      expect(parseWithholdingQuarter("2026", quarter, "2026-10-14")).toMatchObject({ ok: false });
    }
  });

  it("refuses a year that isn't a four-digit year up to next year", () => {
    for (const year of ["26", "20260", "abc", "-2026", "2026.5", "1999", "2028"]) {
      expect(parseWithholdingQuarter(year, "1", "2026-10-14")).toMatchObject({ ok: false });
    }
    expect(parseWithholdingQuarter("2027", "1", "2026-10-14")).toEqual({ ok: true, year: 2027, quarter: 1 });
  });

  it("refuses one of the two on its own", () => {
    expect(parseWithholdingQuarter("2026", null, "2026-10-14")).toMatchObject({ ok: false });
    expect(parseWithholdingQuarter(null, "2", "2026-10-14")).toMatchObject({ ok: false });
  });
});
