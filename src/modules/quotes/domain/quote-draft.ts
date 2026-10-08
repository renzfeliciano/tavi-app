import { parseDocumentDraft, type ParsedLine, type RawLine } from "@/modules/documents/client";
import type { CalendarDate } from "@/shared/dates/calendar";

// A quote as the editor autosaves it: the shared document draft, with
// "valid until" as its second date.

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

export function parseQuoteDraft(
  input: unknown,
  { locale, units = null }: { locale: string; units?: readonly string[] | null },
): QuoteDraftResult {
  const result = parseDocumentDraft(input, {
    locale,
    units,
    endDateField: "validUntil",
    endBeforeIssue: "Choose a date on or after the quote date.",
  });
  if (!result.ok) return result;
  const { endDate, ...rest } = result.draft;
  return { ok: true, draft: { ...rest, validUntil: endDate } };
}
