import { describe, expect, it } from "vitest";
import { blankLine } from "@/modules/documents/client";
import { parseQuoteDraft, type RawQuoteDraft } from "./quote-draft";

const CUSTOMER = "01890000-0000-7000-8000-000000000000";
const draft = (overrides: Partial<RawQuoteDraft> = {}): RawQuoteDraft => ({
  customerId: CUSTOMER,
  currency: "PHP",
  issueDate: "2026-10-01",
  validUntil: "2026-10-31",
  notes: "Thank you!",
  terms: "",
  lines: [{ ...blankLine(), description: "Aircon cleaning", quantity: "2", unitLabel: "unit", unitPrice: "1,500" }],
  ...overrides,
});

describe("parseQuoteDraft", () => {
  it("reads a complete draft", () => {
    expect(parseQuoteDraft(draft(), { locale: "en-PH" })).toEqual({
      ok: true,
      draft: {
        customerId: CUSTOMER,
        currency: "PHP",
        issueDate: "2026-10-01",
        validUntil: "2026-10-31",
        notes: "Thank you!",
        terms: null,
        lines: [expect.objectContaining({ description: "Aircon cleaning", quantity: 20_000, unitPriceMinor: 150_000 })],
      },
    });
  });

  it("lets a draft be saved before a customer or any line is chosen", () => {
    const result = parseQuoteDraft(draft({ customerId: "", lines: [] }), { locale: "en-PH" });
    expect(result).toMatchObject({ ok: true, draft: { customerId: null, lines: [] } });
  });

  it("tolerates missing or malformed fields from the client", () => {
    const result = parseQuoteDraft({ currency: "PHP", issueDate: "2026-10-01", validUntil: "2026-10-01", lines: "x" }, {
      locale: "en-PH",
    });
    expect(result).toMatchObject({ ok: true, draft: { customerId: null, notes: null, lines: [] } });
  });

  it("explains header problems alongside line problems", () => {
    const result = parseQuoteDraft(
      draft({
        customerId: "not-an-id",
        issueDate: "2026-02-30",
        validUntil: "2026-09-01",
        lines: [{ ...blankLine(), description: "Filter", quantity: "x", unitLabel: "pc", unitPrice: "100" }],
      }),
      { locale: "en-PH" },
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        customerId: "Choose a customer from the list.",
        issueDate: "Enter a real date.",
        "lines.0.quantity": "Enter a quantity like 1.5.",
      },
    });
  });

  it("needs the valid-until date on or after the quote date", () => {
    expect(parseQuoteDraft(draft({ validUntil: "2026-09-30" }), { locale: "en-PH" })).toEqual({
      ok: false,
      errors: { validUntil: "Choose a date on or after the quote date." },
    });
  });

  it("needs a currency before prices can be read", () => {
    expect(parseQuoteDraft(draft({ currency: "XYZ" }), { locale: "en-PH" })).toEqual({
      ok: false,
      errors: { currency: "Choose a currency." },
    });
  });
});
