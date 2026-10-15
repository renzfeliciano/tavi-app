import { z } from "zod";
import { type ParsedLine, parseDocumentLines, type RawLine, rawLineSchema } from "@/modules/documents/client";
import { type CalendarDate, compareDates, isCalendarDate } from "@/shared/dates/calendar";
import { isCurrencyCode } from "@/shared/money";
import { tooLong } from "@/shared/validation/messages";
import { PO_LIMITS } from "./limits";

// A purchase order as the form saves it. Drafts may be incomplete (no supplier
// or lines yet); what's there must be valid. Issuing adds its own checks
// (`readinessToIssue`). The expected date is optional.

export type RawPurchaseOrderDraft = {
  supplierId: string;
  currency: string;
  orderDate: string;
  expectedDate: string;
  notes: string;
  terms: string;
  lines: RawLine[];
};

export type PurchaseOrderDraft = {
  supplierId: string | null;
  currency: string;
  orderDate: CalendarDate;
  expectedDate: CalendarDate | null;
  notes: string | null;
  terms: string | null;
  lines: ParsedLine[];
};

export type PurchaseOrderDraftResult =
  | { ok: true; draft: PurchaseOrderDraft }
  | { ok: false; errors: Record<string, string> };

const rawSchema = z.object({
  supplierId: z.string().catch(""),
  currency: z.string().catch(""),
  orderDate: z.string().catch(""),
  expectedDate: z.string().catch(""),
  notes: z.string().catch(""),
  terms: z.string().catch(""),
  lines: z.array(rawLineSchema).catch([]),
});

const textOrNull = (value: string) => (value.trim() === "" ? null : value.trim());

export function parsePurchaseOrderDraft(
  input: unknown,
  { locale, units = null }: { locale: string; units?: readonly string[] | null },
): PurchaseOrderDraftResult {
  const raw = rawSchema.parse(typeof input === "object" && input !== null ? input : {});
  const errors: Record<string, string> = {};

  const supplierId = raw.supplierId === "" ? null : raw.supplierId;
  if (supplierId !== null && !z.uuid().safeParse(supplierId).success) {
    errors.supplierId = "Choose a supplier from the list.";
  }

  const orderOk = isCalendarDate(raw.orderDate);
  if (!orderOk) errors.orderDate = "Enter a real date.";
  const expected = raw.expectedDate.trim();
  if (expected !== "") {
    if (!isCalendarDate(expected)) errors.expectedDate = "Enter a real date.";
    else if (orderOk && compareDates(expected, raw.orderDate) < 0) {
      errors.expectedDate = "Choose a date on or after the order date.";
    }
  }

  if (raw.notes.trim().length > PO_LIMITS.notes) errors.notes = tooLong(PO_LIMITS.notes);
  if (raw.terms.trim().length > PO_LIMITS.terms) errors.terms = tooLong(PO_LIMITS.terms);

  // Prices are read in the currency's decimals, so lines wait for a valid one.
  if (!isCurrencyCode(raw.currency)) {
    errors.currency = "Choose a currency.";
    return { ok: false, errors };
  }
  const lines = parseDocumentLines(raw.lines, { currency: raw.currency, locale, units });
  if (!lines.ok) Object.assign(errors, lines.errors);
  if (Object.keys(errors).length > 0 || !lines.ok) return { ok: false, errors };

  return {
    ok: true,
    draft: {
      supplierId,
      currency: raw.currency,
      orderDate: raw.orderDate,
      expectedDate: expected === "" ? null : expected,
      notes: textOrNull(raw.notes),
      terms: textOrNull(raw.terms),
      lines: lines.lines,
    },
  };
}
