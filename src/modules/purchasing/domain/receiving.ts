import { z } from "zod";
import { type CalendarDate, compareDates, isCalendarDate } from "@/shared/dates/calendar";
import { tooLong } from "@/shared/validation/messages";
import { PO_LIMITS } from "./limits";

/** Problems that stop a draft from being issued, keyed like the form's fields; empty when ready. */
export function readinessToIssue(order: { supplierId: string | null; lineCount: number }): Record<string, string> {
  const problems: Record<string, string> = {};
  if (!order.supplierId) problems.supplierId = "Choose a supplier before issuing.";
  if (order.lineCount === 0) problems.lines = "Add at least one item before issuing.";
  return problems;
}

export type Receipt = { receivedDate: CalendarDate; note: string | null };
export type ReceiptResult = { ok: true; receipt: Receipt } | { ok: false; errors: Record<string, string> };

const rawReceipt = z.object({ receivedDate: z.string().catch(""), note: z.string().catch("") });

/** When the goods arrived: a real date, not in the future, not before the order. */
export function parseReceipt(
  input: unknown,
  { orderDate, today }: { orderDate: CalendarDate; today: CalendarDate },
): ReceiptResult {
  const raw = rawReceipt.parse(typeof input === "object" && input !== null ? input : {});
  const errors: Record<string, string> = {};
  const date = raw.receivedDate.trim();
  if (!isCalendarDate(date)) errors.receivedDate = "Enter a real date.";
  else if (compareDates(date, today) > 0) errors.receivedDate = "Choose today or an earlier date.";
  else if (compareDates(date, orderDate) < 0) errors.receivedDate = "Choose a date on or after the order date.";
  const note = raw.note.trim();
  if (note.length > PO_LIMITS.receiptNote) errors.note = tooLong(PO_LIMITS.receiptNote);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, receipt: { receivedDate: date, note: note === "" ? null : note } };
}
