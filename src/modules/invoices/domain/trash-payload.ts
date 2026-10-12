import { z } from "zod";
import type { QualifiedDiscountSnapshot } from "./qualified-discount";

// What the recycle bin keeps of a deleted draft invoice (D27): the draft's own
// fields and its lines, as JSON. Only drafts are ever deleted, so there is
// nothing issued (number, snapshots, payments) to keep. `v` lets a later change
// to the shape tell old items from new.

const minor = z.number().int().nonnegative();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const headerSchema = z.object({
  customerId: z.uuid().nullable(),
  sourceQuoteId: z.uuid().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  taxMode: z.enum(["inclusive", "exclusive"]),
  issueDate: date,
  dueDate: date,
  notes: z.string().nullable(),
  terms: z.string().nullable(),
  qualifiedDiscount: z.custom<QualifiedDiscountSnapshot | null>((value) => value === null || typeof value === "object"),
  subtotalMinor: minor,
  discountTotalMinor: minor,
  taxTotalMinor: minor,
  totalMinor: minor,
  qualifiedDiscountMinor: minor,
  taxWaivedMinor: minor,
});

const lineSchema = z.object({
  position: z.number().int().nonnegative(),
  description: z.string(),
  unitLabel: z.string(),
  quantity: z.number().int().positive(),
  unitPriceMinor: minor,
  discountKind: z.enum(["percent", "amount"]).nullable(),
  discountValue: z.number().int().nonnegative().nullable(),
  taxRateId: z.uuid().nullable(),
  taxRateName: z.string().nullable(),
  taxRateBps: z.number().int().min(0).max(10_000).nullable(),
  sourceKind: z.enum(["product", "service"]).nullable(),
  sourceId: z.uuid().nullable(),
  grossMinor: minor,
  discountMinor: minor,
  taxMinor: minor,
  totalMinor: minor,
  qualifiedDiscountMinor: minor,
  taxWaivedMinor: minor,
});

const payloadSchema = z.object({ v: z.literal(1), header: headerSchema, lines: z.array(lineSchema) });

export type InvoiceTrashPayload = z.infer<typeof payloadSchema>;
export type InvoiceTrashHeader = z.infer<typeof headerSchema>;
export type InvoiceTrashLine = z.infer<typeof lineSchema>;

/** The payload for a draft: picks exactly the draft fields, whatever else the row carries. */
export function invoiceTrashPayload(header: InvoiceTrashHeader, lines: readonly InvoiceTrashLine[]): InvoiceTrashPayload {
  return { v: 1, header: headerSchema.parse(header), lines: lines.map((line) => lineSchema.parse(line)) };
}

export function parseInvoiceTrashPayload(value: unknown): { ok: true; payload: InvoiceTrashPayload } | { ok: false } {
  const parsed = payloadSchema.safeParse(value);
  return parsed.success ? { ok: true, payload: parsed.data } : { ok: false };
}
