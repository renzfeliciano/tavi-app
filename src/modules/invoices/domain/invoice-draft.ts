import { parseDocumentDraft, type ParsedLine, type RawLine } from "@/modules/documents/client";
import type { CalendarDate } from "@/shared/dates/calendar";

// An invoice as the editor autosaves it: the shared document draft, with the
// due date as its second date.

export type RawInvoiceDraft = {
  customerId: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  terms: string;
  lines: RawLine[];
};

export type InvoiceDraft = {
  customerId: string | null;
  currency: string;
  issueDate: CalendarDate;
  dueDate: CalendarDate;
  notes: string | null;
  terms: string | null;
  lines: ParsedLine[];
};

export type InvoiceDraftResult = { ok: true; draft: InvoiceDraft } | { ok: false; errors: Record<string, string> };

export function parseInvoiceDraft(input: unknown, { locale }: { locale: string }): InvoiceDraftResult {
  const result = parseDocumentDraft(input, {
    locale,
    endDateField: "dueDate",
    endBeforeIssue: "Choose a due date on or after the invoice date.",
  });
  if (!result.ok) return result;
  const { endDate, ...rest } = result.draft;
  return { ok: true, draft: { ...rest, dueDate: endDate } };
}
