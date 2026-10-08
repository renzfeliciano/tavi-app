import { describe, expect, it } from "vitest";
import { blankLine } from "@/modules/documents/client";
import { MARKETS } from "@/config/markets";
import { parseInvoiceDraft } from "./invoice-draft";

const draft = {
  customerId: "",
  currency: "PHP",
  issueDate: "2026-10-01",
  dueDate: "2026-10-31",
  notes: "",
  terms: "",
  lines: [{ ...blankLine(), description: "Aircon cleaning", quantity: "2", unitLabel: "unit", unitPrice: "1,500" }],
};

describe("parseInvoiceDraft", () => {
  it("reads the due date as the invoice's second date", () => {
    const result = parseInvoiceDraft(draft, { locale: "en-PH" });
    expect(result.ok && result.draft).toMatchObject({ issueDate: "2026-10-01", dueDate: "2026-10-31" });
    expect(result.ok && result.draft.lines[0]?.unitPriceMinor).toBe(150000);
  });

  it("won't have the due date before the invoice date", () => {
    expect(parseInvoiceDraft({ ...draft, dueDate: "2026-09-30" }, { locale: "en-PH" })).toEqual({
      ok: false,
      errors: { dueDate: "Choose a due date on or after the invoice date." },
    });
  });

  it("has no qualified discount unless one is chosen", () => {
    const result = parseInvoiceDraft(draft, { locale: "en-PH", qualifiedDiscounts: MARKETS.PH.qualifiedDiscounts });
    expect(result.ok && result.draft.qualifiedDiscount).toBeNull();
  });

  it("reads a qualified discount with the market's rate (D19)", () => {
    const result = parseInvoiceDraft(
      { ...draft, qualifiedDiscount: { kind: "senior_citizen", idNumber: "OSCA-77", holderName: "Lola Remedios" } },
      { locale: "en-PH", qualifiedDiscounts: MARKETS.PH.qualifiedDiscounts },
    );
    expect(result.ok && result.draft.qualifiedDiscount).toMatchObject({ kind: "senior_citizen", rateBps: 2000, taxExempt: true, idNumber: "OSCA-77" });
  });

  it("reports a qualified discount's problems with the rest of the draft's", () => {
    const result = parseInvoiceDraft(
      {
        ...draft,
        dueDate: "2026-09-30",
        lines: [{ ...draft.lines[0], discountKind: "percent", discountValue: "10" }],
        qualifiedDiscount: { kind: "pwd", idNumber: "", holderName: "Carlo" },
      },
      { locale: "en-PH", qualifiedDiscounts: MARKETS.PH.qualifiedDiscounts },
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        dueDate: "Choose a due date on or after the invoice date.",
        "qualifiedDiscount.kind": MARKETS.PH.qualifiedDiscounts.notWithLineDiscounts,
        "qualifiedDiscount.idNumber": "Enter the PWD ID No.",
      },
    });
  });
});
