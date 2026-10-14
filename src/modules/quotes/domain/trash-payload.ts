import { z } from "zod";

// What the recycle bin keeps of a deleted draft quote (D27): the draft's own
// fields and its lines, as JSON. Only never-sent drafts are deleted, so there
// is no number, snapshot or decision to keep. `v` versions the shape.

const minor = z.number().int().nonnegative();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const headerSchema = z.object({
  customerId: z.uuid().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  taxMode: z.enum(["inclusive", "exclusive"]),
  issueDate: date,
  validUntil: date,
  notes: z.string().nullable(),
  terms: z.string().nullable(),
  subtotalMinor: minor,
  discountTotalMinor: minor,
  taxTotalMinor: minor,
  totalMinor: minor,
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
});

const payloadSchema = z.object({ v: z.literal(1), header: headerSchema, lines: z.array(lineSchema) });

const moment = z.iso.datetime();
const text = z.string().nullable();

// A quotation that was sent (version 2): the whole row, so restoring puts back its number, status,
// the customer and business as they were when it went out, and any decision. A quotation that became a
// billing statement is never deleted, so there is no conversion to keep.
const sentSchema = z.object({
  v: z.literal(2),
  quote: z.object({
    customerId: z.uuid().nullable(),
    number: z.string(),
    revision: z.number().int().min(1),
    status: z.enum(["DRAFT", "SENT", "VIEWED", "APPROVED", "REJECTED", "EXPIRED", "CANCELLED"]),
    currency: z.string().regex(/^[A-Z]{3}$/),
    taxMode: z.enum(["inclusive", "exclusive"]),
    issueDate: date,
    validUntil: date,
    customerSnapshot: z.record(z.string(), z.unknown()).nullable(),
    sellerSnapshot: z.record(z.string(), z.unknown()).nullable(),
    notes: text,
    terms: text,
    subtotalMinor: minor,
    discountTotalMinor: minor,
    taxTotalMinor: minor,
    totalMinor: minor,
    sentAt: moment.nullable(),
    viewedAt: moment.nullable(),
    decidedAt: moment.nullable(),
    decisionName: text,
    decisionNote: text,
    decisionContentHash: text,
    decisionIp: text,
    decisionUserAgent: text,
    cancelledAt: moment.nullable(),
    cancelReason: text,
    createdBy: z.uuid().nullable(),
    createdAt: moment,
    updatedAt: moment,
  }),
  lines: z.array(lineSchema),
});

export type SentQuoteTrashPayload = z.infer<typeof sentSchema>;

/** The payload for a sent quotation: picks exactly the kept fields, whatever else the row carries. */
export function sentQuoteTrashPayload(quote: SentQuoteTrashPayload["quote"], lines: readonly QuoteTrashLine[]): SentQuoteTrashPayload {
  return sentSchema.parse({ v: 2, quote, lines: lines.map((line) => lineSchema.parse(line)) });
}

export function parseSentQuoteTrashPayload(value: unknown): { ok: true; payload: SentQuoteTrashPayload } | { ok: false } {
  const parsed = sentSchema.safeParse(value);
  return parsed.success ? { ok: true, payload: parsed.data } : { ok: false };
}

export type QuoteTrashPayload = z.infer<typeof payloadSchema>;
export type QuoteTrashHeader = z.infer<typeof headerSchema>;
export type QuoteTrashLine = z.infer<typeof lineSchema>;

/** The payload for a draft: picks exactly the draft fields, whatever else the row carries. */
export function quoteTrashPayload(header: QuoteTrashHeader, lines: readonly QuoteTrashLine[]): QuoteTrashPayload {
  return { v: 1, header: headerSchema.parse(header), lines: lines.map((line) => lineSchema.parse(line)) };
}

export function parseQuoteTrashPayload(value: unknown): { ok: true; payload: QuoteTrashPayload } | { ok: false } {
  const parsed = payloadSchema.safeParse(value);
  return parsed.success ? { ok: true, payload: parsed.data } : { ok: false };
}
