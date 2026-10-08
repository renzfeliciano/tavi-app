import { z } from "zod";
import { type CalendarDate, compareDates, isCalendarDate } from "@/shared/dates/calendar";
import { isCurrencyCode } from "@/shared/money";
import { tooLong } from "@/shared/validation/messages";
import { DOCUMENT_LIMITS, type ParsedLine, parseDocumentLines, type RawLine, rawLineSchema } from "./line-input";

// A quote or invoice as the editor autosaves it. Drafts may be incomplete (no
// customer or lines yet); what's there must be valid. Sending adds its own
// checks. The second date differs by document (valid until, due), so it's
// read as `endDate` and each document names it.

export type RawDocumentDraft = {
  customerId: string;
  currency: string;
  issueDate: string;
  endDate: string;
  notes: string;
  terms: string;
  lines: RawLine[];
};

export type DocumentDraft = {
  customerId: string | null;
  currency: string;
  issueDate: CalendarDate;
  endDate: CalendarDate;
  notes: string | null;
  terms: string | null;
  lines: ParsedLine[];
};

export type DocumentDraftResult = { ok: true; draft: DocumentDraft } | { ok: false; errors: Record<string, string> };

export type DocumentDraftOptions = {
  locale: string;
  /** The market's units; lines must use one. Null (the default) skips the check. */
  units?: readonly string[] | null;
  /** The payload key and error key of the second date, e.g. "validUntil". */
  endDateField: string;
  /** Shown when the second date is before the document date. */
  endBeforeIssue: string;
};

const rawDraftSchema = z.object({
  customerId: z.string().catch(""),
  currency: z.string().catch(""),
  issueDate: z.string().catch(""),
  notes: z.string().catch(""),
  terms: z.string().catch(""),
  lines: z.array(rawLineSchema).catch([]),
});

const textOrNull = (value: string) => (value.trim() === "" ? null : value.trim());

export function parseDocumentDraft(input: unknown, options: DocumentDraftOptions): DocumentDraftResult {
  const source = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const raw = rawDraftSchema.parse(source);
  const endValue = source[options.endDateField];
  const endDate = typeof endValue === "string" ? endValue : "";
  const endKey = options.endDateField;
  const errors: Record<string, string> = {};

  const customerId = raw.customerId === "" ? null : raw.customerId;
  if (customerId !== null && !z.uuid().safeParse(customerId).success) {
    errors.customerId = "Choose a customer from the list.";
  }

  const issueOk = isCalendarDate(raw.issueDate);
  const endOk = isCalendarDate(endDate);
  if (!issueOk) errors.issueDate = "Enter a real date.";
  if (!endOk) errors[endKey] = "Enter a real date.";
  if (issueOk && endOk && compareDates(endDate, raw.issueDate) < 0) errors[endKey] = options.endBeforeIssue;

  for (const field of ["notes", "terms"] as const) {
    const limit = DOCUMENT_LIMITS[field];
    if (raw[field].trim().length > limit) errors[field] = tooLong(limit);
  }

  // Prices are read in the currency's decimals, so lines wait for a valid one.
  if (!isCurrencyCode(raw.currency)) {
    errors.currency = "Choose a currency.";
    return { ok: false, errors };
  }
  const lines = parseDocumentLines(raw.lines, { currency: raw.currency, locale: options.locale, units: options.units ?? null });
  if (!lines.ok) Object.assign(errors, lines.errors);

  if (Object.keys(errors).length > 0 || !lines.ok) return { ok: false, errors };
  return {
    ok: true,
    draft: {
      customerId,
      currency: raw.currency,
      issueDate: raw.issueDate,
      endDate,
      notes: textOrNull(raw.notes),
      terms: textOrNull(raw.terms),
      lines: lines.lines,
    },
  };
}
