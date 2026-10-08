import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import type { PaymentMethod } from "@/config/markets";
import { type Database, getDb } from "@/db";
import { assertCan, type OrgActor } from "@/modules/authz";
import type { CalendarDate } from "@/shared/dates/calendar";
import { payments } from "../schema";

// What the reports ask of payments (2.2, D18): what came in during a period.
// A payment counts on the day it was paid; voided payments never count.

export type ReceivedPayment = {
  invoiceId: string;
  receiptNumber: string;
  paidOn: CalendarDate;
  method: PaymentMethod;
  reference: string | null;
  currency: string;
  amountMinor: number;
  withheldMinor: number;
};

/** Active payments paid from `from` to `to` (both included), newest first. */
export async function paymentsReceivedBetween(
  actor: OrgActor,
  { from, to }: { from: CalendarDate; to: CalendarDate },
  db: Database = getDb(),
): Promise<ReceivedPayment[]> {
  assertCan(actor, "payments.read");
  return db
    .select({
      invoiceId: payments.invoiceId,
      receiptNumber: payments.receiptNumber,
      paidOn: payments.paidOn,
      method: payments.method,
      reference: payments.reference,
      currency: payments.currency,
      amountMinor: payments.amountMinor,
      withheldMinor: payments.withheldMinor,
    })
    .from(payments)
    .where(
      and(
        eq(payments.organizationId, actor.organizationId),
        isNull(payments.voidedAt),
        gte(payments.paidOn, from),
        lte(payments.paidOn, to),
      ),
    )
    .orderBy(desc(payments.paidOn), desc(payments.createdAt));
}

/**
 * Creditable tax the buyer withheld on each of these bills, over their
 * active payments (PH: Form 2307), for e-invoice exports (D19). Bills with
 * none are left out of the map.
 */
export async function taxWithheldByInvoice(
  actor: OrgActor,
  invoiceIds: readonly string[],
  db: Database = getDb(),
): Promise<Map<string, number>> {
  assertCan(actor, "payments.read");
  if (invoiceIds.length === 0) return new Map();
  const rows = await db
    .select({ invoiceId: payments.invoiceId, withheldMinor: sql<string>`sum(${payments.withheldMinor})` })
    .from(payments)
    .where(and(eq(payments.organizationId, actor.organizationId), isNull(payments.voidedAt), inArray(payments.invoiceId, [...invoiceIds])))
    .groupBy(payments.invoiceId);
  return new Map(rows.map((row) => [row.invoiceId, Number(row.withheldMinor)]));
}
