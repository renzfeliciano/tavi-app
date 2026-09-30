import { z } from "zod";
import { DOCUMENT_LIMITS, type ParsedLine, parseDocumentLines, rawLineSchema, type RawLine } from "@/modules/documents/client";
import { type CalendarDate, compareDates, isCalendarDate } from "@/shared/dates/calendar";
import { isCurrencyCode } from "@/shared/money";

// A quote as the editor autosaves it. Drafts may be incomplete (no customer
// or lines yet); what's there must be valid. Sending adds its own checks.

export type RawQuoteDraft = {
  customerId: string;
  currency: string;
  issueDate: string;
  validUntil: string;
  notes: string;
  terms: string;
  lines: RawLine[];
};

export type QuoteDraft = {
  customerId: string | null;
  currency: string;
  issueDate: CalendarDate;
  validUntil: CalendarDate;
  notes: string | null;
  terms: string | null;
  lines: ParsedLine[];
};

export type QuoteDraftResult = { ok: true; draft: QuoteDraft } | { ok: false; errors: Record<string, string> };

const rawDraftSchema = z.object({
  customerId: z.string().catch(""),
  currency: z.string().catch(""),
  issueDate: z.string().catch(""),
  validUntil: z.string().catch(""),
  notes: z.string().catch(""),
  terms: z.string().catch(""),
  lines: z.array(rawLineSchema).catch([]),
});

const textOrNull = (value: string) => (value.trim() === "" ? null : value.trim());

export function parseQuoteDraft(input: unknown, { locale }: { locale: string }): QuoteDraftResult {
  const raw = rawDraftSchema.parse(typeof input === "object" && input !== null ? input : {});
  const errors: Record<string, string> = {};

  const customerId = raw.customerId === "" ? null : raw.customerId;
  if (customerId !== null && !z.uuid().safeParse(customerId).success) {
    errors.customerId = "Choose a customer from the list.";
  }

  const issueOk = isCalendarDate(raw.issueDate);
  const validOk = isCalendarDate(raw.validUntil);
  if (!issueOk) errors.issueDate = "Enter a real date.";
  if (!validOk) errors.validUntil = "Enter a real date.";
  if (issueOk && validOk && compareDates(raw.validUntil, raw.issueDate) < 0) {
    errors.validUntil = "Choose a date on or after the quote date.";
  }

  for (const field of ["notes", "terms"] as const) {
    const limit = DOCUMENT_LIMITS[field];
    if (raw[field].trim().length > limit) errors[field] = `Use ${limit.toLocaleString("en")} characters or fewer.`;
  }

  // Prices are read in the currency's decimals, so lines wait for a valid one.
  if (!isCurrencyCode(raw.currency)) {
    errors.currency = "Choose a currency.";
    return { ok: false, errors };
  }
  const lines = parseDocumentLines(raw.lines, { currency: raw.currency, locale });
  if (!lines.ok) Object.assign(errors, lines.errors);

  if (Object.keys(errors).length > 0 || !lines.ok) return { ok: false, errors };
  return {
    ok: true,
    draft: {
      customerId,
      currency: raw.currency,
      issueDate: raw.issueDate,
      validUntil: raw.validUntil,
      notes: textOrNull(raw.notes),
      terms: textOrNull(raw.terms),
      lines: lines.lines,
    },
  };
}
