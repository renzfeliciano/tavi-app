import { parseDocumentDraft, type ParsedLine, type RawLine } from "@/modules/documents/client";
import type { CalendarDate } from "@/shared/dates/calendar";
import {
  parseQualifiedDiscount,
  type QualifiedDiscountConfig,
  type QualifiedDiscountSnapshot,
  type RawQualifiedDiscount,
} from "./qualified-discount";

// An invoice as the editor autosaves it: the shared document draft, with the
// due date as its second date and, where the market has them, a qualified
// discount for the buyer (D19).

export type RawInvoiceDraft = {
  customerId: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  terms: string;
  lines: RawLine[];
  qualifiedDiscount?: RawQualifiedDiscount;
};

export type InvoiceDraft = {
  customerId: string | null;
  currency: string;
  issueDate: CalendarDate;
  dueDate: CalendarDate;
  notes: string | null;
  terms: string | null;
  lines: ParsedLine[];
  qualifiedDiscount: QualifiedDiscountSnapshot | null;
};

export type InvoiceDraftResult = { ok: true; draft: InvoiceDraft } | { ok: false; errors: Record<string, string> };

export function parseInvoiceDraft(
  input: unknown,
  {
    locale,
    units = null,
    qualifiedDiscounts = null,
  }: { locale: string; units?: readonly string[] | null; qualifiedDiscounts?: QualifiedDiscountConfig | null },
): InvoiceDraftResult {
  const result = parseDocumentDraft(input, {
    locale,
    units,
    endDateField: "dueDate",
    endBeforeIssue: "Choose a due date on or after the invoice date.",
  });
  const source = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const discount = parseQualifiedDiscount(source.qualifiedDiscount, qualifiedDiscounts, {
    hasLineDiscounts: result.ok
      ? result.draft.lines.some(
          (line) => line.discount !== null && (line.discount.kind === "percent" ? line.discount.bps : line.discount.amountMinor) > 0,
        )
      : Array.isArray(source.lines) && source.lines.some((line) => hasDiscount(line)),
  });
  if (!result.ok || !discount.ok) {
    return { ok: false, errors: { ...(result.ok ? {} : result.errors), ...(discount.ok ? {} : discount.errors) } };
  }
  const { endDate, ...rest } = result.draft;
  return { ok: true, draft: { ...rest, dueDate: endDate, qualifiedDiscount: discount.discount } };
}

/** Whether a raw editor line asks for its own discount (used while other fields are still invalid). */
function hasDiscount(line: unknown): boolean {
  if (typeof line !== "object" || line === null) return false;
  const { discountKind, discountValue } = line as Record<string, unknown>;
  return (
    (discountKind === "percent" || discountKind === "amount") &&
    typeof discountValue === "string" &&
    /[1-9]/.test(discountValue)
  );
}
