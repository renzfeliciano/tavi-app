import { describe, expect, it } from "vitest";
import { blankLine } from "@/modules/documents/client";
import { PO_LIMITS } from "./limits";
import { parsePurchaseOrderDraft, type RawPurchaseOrderDraft } from "./purchase-order-draft";

const SUPPLIER = "01890000-0000-7000-8000-000000000000";
const draft = (overrides: Partial<RawPurchaseOrderDraft> = {}): RawPurchaseOrderDraft => ({
  supplierId: SUPPLIER,
  currency: "PHP",
  orderDate: "2026-10-01",
  expectedDate: "2026-10-08",
  notes: "Deliver to the back door.",
  terms: "",
  lines: [{ ...blankLine(), description: "Copper pipe 1/2 in", quantity: "20", unitLabel: "pc", unitPrice: "145.50" }],
  ...overrides,
});
const options = { locale: "en-PH" };

describe("parsePurchaseOrderDraft", () => {
  it("reads a complete draft", () => {
    expect(parsePurchaseOrderDraft(draft(), options)).toEqual({
      ok: true,
      draft: {
        supplierId: SUPPLIER,
        currency: "PHP",
        orderDate: "2026-10-01",
        expectedDate: "2026-10-08",
        notes: "Deliver to the back door.",
        terms: null,
        lines: [expect.objectContaining({ description: "Copper pipe 1/2 in", quantity: 200_000, unitPriceMinor: 14_550 })],
      },
    });
  });

  it("accepts an incomplete draft: no supplier, no lines, no expected date", () => {
    const result = parsePurchaseOrderDraft(draft({ supplierId: "", expectedDate: "", lines: [] }), options);
    expect(result).toMatchObject({ ok: true, draft: { supplierId: null, expectedDate: null, lines: [] } });
  });

  it("refuses a supplier that is not an id", () => {
    expect(parsePurchaseOrderDraft(draft({ supplierId: "santos" }), options)).toEqual({
      ok: false,
      errors: { supplierId: "Choose a supplier from the list." },
    });
  });

  it("refuses dates that are not real, and an expected date before the order date", () => {
    expect(parsePurchaseOrderDraft(draft({ orderDate: "2026-02-31" }), options)).toMatchObject({
      ok: false,
      errors: { orderDate: "Enter a real date." },
    });
    expect(parsePurchaseOrderDraft(draft({ expectedDate: "2026-09-30" }), options)).toMatchObject({
      ok: false,
      errors: { expectedDate: "Choose a date on or after the order date." },
    });
    expect(parsePurchaseOrderDraft(draft({ expectedDate: "tomorrow" }), options)).toMatchObject({
      ok: false,
      errors: { expectedDate: "Enter a real date." },
    });
  });

  it("allows the expected date to be the order date", () => {
    expect(parsePurchaseOrderDraft(draft({ expectedDate: "2026-10-01" }), options).ok).toBe(true);
  });

  it("refuses notes and terms that are too long", () => {
    const result = parsePurchaseOrderDraft(
      draft({ notes: "x".repeat(PO_LIMITS.notes + 1), terms: "y".repeat(PO_LIMITS.terms + 1) }),
      options,
    );
    expect(result).toEqual({
      ok: false,
      errors: { notes: "Use 2,000 characters or fewer.", terms: "Use 2,000 characters or fewer." },
    });
  });

  it("refuses an unknown currency", () => {
    expect(parsePurchaseOrderDraft(draft({ currency: "XYZ" }), options)).toEqual({
      ok: false,
      errors: { currency: "Choose a currency." },
    });
  });

  it("reports line problems under the line's own key", () => {
    const result = parsePurchaseOrderDraft(
      draft({ lines: [{ ...blankLine(), description: "Copper pipe", quantity: "0", unitLabel: "pc", unitPrice: "1" }] }),
      options,
    );
    expect(result).toMatchObject({ ok: false, errors: { "lines.0.quantity": expect.any(String) } });
  });

  it("treats a missing or garbled payload as an empty draft with errors, not a crash", () => {
    expect(parsePurchaseOrderDraft(null, options)).toMatchObject({ ok: false });
    expect(parsePurchaseOrderDraft("nope", options)).toMatchObject({ ok: false });
  });
});
