import { describe, expect, it } from "vitest";
import { blankLine } from "@/modules/documents/client";
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
});
