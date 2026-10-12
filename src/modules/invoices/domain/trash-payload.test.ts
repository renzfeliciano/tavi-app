import { describe, expect, it } from "vitest";
import { invoiceTrashPayload, parseInvoiceTrashPayload } from "./trash-payload";

const header = {
  customerId: "0190b7e0-0000-7000-8000-000000000001",
  sourceQuoteId: null,
  currency: "PHP",
  taxMode: "exclusive" as const,
  issueDate: "2026-10-01",
  dueDate: "2026-10-16",
  notes: "Thank you",
  terms: null,
  qualifiedDiscount: null,
  subtotalMinor: 80_000,
  discountTotalMinor: 0,
  taxTotalMinor: 9_600,
  totalMinor: 89_600,
  qualifiedDiscountMinor: 0,
  taxWaivedMinor: 0,
};

const line = {
  position: 0,
  description: "Aircon cleaning",
  unitLabel: "unit",
  quantity: 20_000,
  unitPriceMinor: 40_000,
  discountKind: null,
  discountValue: null,
  taxRateId: null,
  taxRateName: "VAT",
  taxRateBps: 1200,
  sourceKind: null,
  sourceId: null,
  grossMinor: 80_000,
  discountMinor: 0,
  taxMinor: 9_600,
  totalMinor: 89_600,
  qualifiedDiscountMinor: 0,
  taxWaivedMinor: 0,
};

describe("invoice trash payload", () => {
  it("survives being stored as JSON", () => {
    const stored = JSON.parse(JSON.stringify(invoiceTrashPayload(header, [line])));
    expect(parseInvoiceTrashPayload(stored)).toEqual({ ok: true, payload: { v: 1, header, lines: [line] } });
  });

  it("keeps only the draft's own fields, never an issued invoice's", () => {
    const payload = invoiceTrashPayload({ ...header, number: "INV-000001", status: "SENT" } as typeof header, []);
    expect(Object.keys(payload.header).sort()).toEqual(Object.keys(header).sort());
  });

  it("refuses something that isn't a payload", () => {
    expect(parseInvoiceTrashPayload(null)).toEqual({ ok: false });
    expect(parseInvoiceTrashPayload({ v: 2, header, lines: [] })).toEqual({ ok: false });
    expect(parseInvoiceTrashPayload({ v: 1, header: { ...header, totalMinor: "lots" }, lines: [] })).toEqual({ ok: false });
  });
});
