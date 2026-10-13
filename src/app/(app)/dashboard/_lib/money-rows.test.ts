import { describe, expect, it } from "vitest";
import { moneyRows } from "./money-rows";

const owed = (currency: string, overrides: Partial<Parameters<typeof moneyRows>[0][number]> = {}) => ({
  currency,
  outstandingMinor: 0,
  overdueMinor: 0,
  outstandingCount: 0,
  overdueCount: 0,
  oldestOverdueDue: null,
  ...overrides,
});

describe("moneyRows", () => {
  it("lines up what is owed and what was received, per currency", () => {
    const rows = moneyRows(
      [owed("PHP", { outstandingMinor: 500000, outstandingCount: 3, overdueMinor: 200000, overdueCount: 1, oldestOverdueDue: "2026-10-01" })],
      [{ currency: "PHP", receivedMinor: 150000, paymentCount: 2 }],
    );

    expect(rows).toEqual([
      {
        currency: "PHP",
        outstandingMinor: 500000,
        outstandingCount: 3,
        overdueMinor: 200000,
        overdueCount: 1,
        oldestOverdueDue: "2026-10-01",
        receivedMinor: 150000,
        paymentCount: 2,
      },
    ]);
  });

  it("includes a currency that only has payments, or only has bills, with zeros for the rest", () => {
    const rows = moneyRows(
      [owed("USD", { outstandingMinor: 9900, outstandingCount: 1 })],
      [{ currency: "PHP", receivedMinor: 100000, paymentCount: 1 }],
    );

    expect(rows.map((r) => r.currency)).toEqual(["PHP", "USD"]);
    expect(rows[0]).toMatchObject({ outstandingMinor: 0, outstandingCount: 0, overdueCount: 0, oldestOverdueDue: null, receivedMinor: 100000 });
    expect(rows[1]).toMatchObject({ outstandingMinor: 9900, receivedMinor: 0, paymentCount: 0 });
  });

  it("has no rows when there is no money at all", () => {
    expect(moneyRows([], [])).toEqual([]);
  });
});
