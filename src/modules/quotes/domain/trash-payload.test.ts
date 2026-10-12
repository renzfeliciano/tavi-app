import { describe, expect, it } from "vitest";
import { parseQuoteTrashPayload, quoteTrashPayload } from "./trash-payload";

const header = {
  customerId: "0190b7e0-0000-7000-8000-000000000001",
  currency: "PHP",
  taxMode: "inclusive" as const,
  issueDate: "2026-10-01",
  validUntil: "2026-10-15",
  notes: null,
  terms: "50% down payment.",
  subtotalMinor: 80_000,
  discountTotalMinor: 0,
  taxTotalMinor: 8_571,
  totalMinor: 80_000,
};

const line = {
  position: 0,
  description: "Aircon cleaning",
  unitLabel: "unit",
  quantity: 20_000,
  unitPriceMinor: 40_000,
  discountKind: "percent" as const,
  discountValue: 500,
  taxRateId: null,
  taxRateName: "VAT",
  taxRateBps: 1200,
  sourceKind: "service" as const,
  sourceId: "0190b7e0-0000-7000-8000-000000000002",
  grossMinor: 80_000,
  discountMinor: 4_000,
  taxMinor: 8_142,
  totalMinor: 76_000,
};

describe("quote trash payload", () => {
  it("survives being stored as JSON", () => {
    const stored = JSON.parse(JSON.stringify(quoteTrashPayload(header, [line])));
    expect(parseQuoteTrashPayload(stored)).toEqual({ ok: true, payload: { v: 1, header, lines: [line] } });
  });

  it("keeps only the draft's own fields", () => {
    const payload = quoteTrashPayload({ ...header, number: "QUO-000001", status: "SENT" } as typeof header, []);
    expect(Object.keys(payload.header).sort()).toEqual(Object.keys(header).sort());
  });

  it("refuses something that isn't a payload", () => {
    expect(parseQuoteTrashPayload(undefined)).toEqual({ ok: false });
    expect(parseQuoteTrashPayload({ v: 1, header, lines: [{ ...line, quantity: 0 }] })).toEqual({ ok: false });
  });
});
