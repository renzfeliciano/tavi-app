import { describe, expect, it } from "vitest";
import { copyForPrint, countsAsPrint } from "./printing";

const registration = { number: "AC-1", serial: 7 };

describe("countsAsPrint (RR 7-2024 Sec. 6 B.21)", () => {
  it("counts issued registered invoices, whatever their status", () => {
    for (const status of ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID", "CANCELLED"] as const) {
      expect(countsAsPrint({ status, registration })).toBe(true);
    }
  });

  it("never counts drafts or billing statements", () => {
    expect(countsAsPrint({ status: "DRAFT", registration })).toBe(false);
    expect(countsAsPrint({ status: "SENT", registration: null })).toBe(false);
  });
});

describe("copyForPrint", () => {
  it("makes the first print the original and every later one a reprint", () => {
    expect(copyForPrint(1)).toBe("original");
    expect(copyForPrint(2)).toBe("reprint");
    expect(copyForPrint(40)).toBe("reprint");
  });

  it("refuses counts that can't happen", () => {
    expect(() => copyForPrint(0)).toThrow(RangeError);
    expect(() => copyForPrint(1.5)).toThrow(RangeError);
  });
});
