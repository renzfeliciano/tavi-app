import { z } from "zod";
import { PAYMENT_METHODS } from "@/config/markets";
import { type CalendarDate } from "@/shared/dates/calendar";
import { quarterOf } from "./withholding";

// What the recycle bin keeps of a deleted payment or 2307 (docs/superpowers/specs/2026-10-14-owner-delete-recycle-bin-design.md):
// the row (and, for a certificate, its rows) as JSON, dates as text. Only voided ones are deleted, so a payment
// has no certificate link and a certificate has no payment links to keep. `v` versions the shape.

const minor = z.number().int().nonnegative();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const moment = z.iso.datetime();
const currency = z.string().regex(/^[A-Z]{3}$/);

const paymentSchema = z.object({
  v: z.literal(1),
  invoiceId: z.uuid(),
  amountMinor: minor,
  withheldMinor: minor,
  currency,
  paidOn: day,
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().nullable(),
  institution: z.string().nullable(),
  payerName: z.string().nullable(),
  paidTime: z.string().nullable(),
  chequeDate: day.nullable(),
  notes: z.string().nullable(),
  receiptNumber: z.string(),
  provider: z.string(),
  providerPaymentId: z.string().nullable(),
  recordedBy: z.uuid().nullable(),
  voidedAt: moment,
  voidReason: z.string(),
  voidedBy: z.uuid().nullable(),
  createdAt: moment,
  updatedAt: moment,
});

const certificateLineSchema = z.object({
  position: z.number().int().min(1).max(5),
  atcCode: z.string(),
  description: z.string().nullable(),
  rateBps: z.number().int(),
  month1Minor: minor,
  month2Minor: minor,
  month3Minor: minor,
  totalMinor: minor,
  taxWithheldMinor: minor,
});

const certificateSchema = z.object({
  v: z.literal(1),
  customerId: z.uuid(),
  payorTin: z.string(),
  payorName: z.string(),
  payorAddress: z.string().nullable(),
  periodFrom: day,
  periodTo: day,
  receivedOn: day,
  currency,
  notes: z.string().nullable(),
  createdBy: z.uuid().nullable(),
  voidedAt: moment,
  voidReason: z.string(),
  voidedBy: z.uuid().nullable(),
  createdAt: moment,
  updatedAt: moment,
  lines: z.array(certificateLineSchema).min(1).max(5),
});

export type PaymentTrashPayload = z.infer<typeof paymentSchema>;
export type CertificateTrashPayload = z.infer<typeof certificateSchema>;

/** Picks exactly the kept fields, whatever else the row carries. */
export const paymentTrashPayload = (row: Omit<PaymentTrashPayload, "v">): PaymentTrashPayload => paymentSchema.parse({ v: 1, ...row });
export const certificateTrashPayload = (row: Omit<CertificateTrashPayload, "v">): CertificateTrashPayload =>
  certificateSchema.parse({ v: 1, ...row });

export function parsePaymentTrashPayload(value: unknown): { ok: true; payload: PaymentTrashPayload } | { ok: false } {
  const parsed = paymentSchema.safeParse(value);
  return parsed.success ? { ok: true, payload: parsed.data } : { ok: false };
}

export function parseCertificateTrashPayload(value: unknown): { ok: true; payload: CertificateTrashPayload } | { ok: false } {
  const parsed = certificateSchema.safeParse(value);
  return parsed.success ? { ok: true, payload: parsed.data } : { ok: false };
}

/** How a deleted 2307 is named in the bin: who withheld, and the quarter ("Dela Cruz Trading, Q3 2026"). */
export function certificateLabel(payorName: string, periodFrom: CalendarDate): string {
  const { year, quarter } = quarterOf(periodFrom);
  return `${payorName}, Q${quarter} ${year}`;
}
