import { and, asc, eq, gte, inArray, isNotNull, lte, ne, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { MarketProfile } from "@/config/markets";
import { type Database, getDb } from "@/db";
import { assertCan, type OrgActor } from "@/modules/authz";
import { numericToQuantity } from "@/modules/documents";
import type { CalendarDate } from "@/shared/dates/calendar";
import type { EInvoiceSource } from "../domain/e-invoice";
import { invoiceTitle } from "../domain/registration";
import { invoiceLines, invoices } from "../schema";
import { headerColumns } from "./invoices";

// The registered invoices behind an e-invoice export (D19): one invoice, or
// every one issued in a period (void and cancelled ones included, marked, so
// the series has no gaps). Billing statements aren't invoices and never come
// here. The seller and the tax withheld come from the organizations and
// payments modules (the reports module puts them together).

export type EInvoiceRecord = Omit<EInvoiceSource, "seller" | "withheldMinor">;

type Query = { invoiceId: string } | { from: CalendarDate; to: CalendarDate };

export async function registeredInvoicesForExport(
  actor: OrgActor,
  query: Query,
  { market }: { market: Pick<MarketProfile, "documents"> },
  db: Database = getDb(),
): Promise<EInvoiceRecord[]> {
  assertCan(actor, "invoices.read");
  let which: SQL | undefined;
  if ("invoiceId" in query) {
    if (!z.uuid().safeParse(query.invoiceId).success) return [];
    which = eq(invoices.id, query.invoiceId);
  } else {
    which = and(gte(invoices.issueDate, query.from), lte(invoices.issueDate, query.to));
  }
  const headers = await db
    .select(headerColumns)
    .from(invoices)
    .where(and(eq(invoices.organizationId, actor.organizationId), isNotNull(invoices.registration), ne(invoices.status, "DRAFT"), which))
    .orderBy(asc(invoices.issueDate), asc(invoices.number));
  if (headers.length === 0) return [];

  const lines = await db
    .select({
      invoiceId: invoiceLines.invoiceId,
      position: invoiceLines.position,
      description: invoiceLines.description,
      unitLabel: invoiceLines.unitLabel,
      quantity: invoiceLines.quantity,
      unitPriceMinor: invoiceLines.unitPriceMinor,
      grossMinor: invoiceLines.grossMinor,
      discountMinor: invoiceLines.discountMinor,
      taxRateName: invoiceLines.taxRateName,
      taxRateBps: invoiceLines.taxRateBps,
      taxMinor: invoiceLines.taxMinor,
      totalMinor: invoiceLines.totalMinor,
      qualifiedDiscountMinor: invoiceLines.qualifiedDiscountMinor,
      taxWaivedMinor: invoiceLines.taxWaivedMinor,
    })
    .from(invoiceLines)
    .where(
      and(
        eq(invoiceLines.organizationId, actor.organizationId),
        inArray(
          invoiceLines.invoiceId,
          headers.map((h) => h.id),
        ),
      ),
    )
    .orderBy(asc(invoiceLines.invoiceId), asc(invoiceLines.position));
  const linesOf = Map.groupBy(lines, (line) => line.invoiceId);

  return headers.flatMap((h): EInvoiceRecord[] => {
    if (!h.registration || h.number === null) return [];
    const customer = h.customerSnapshot;
    return [
      {
        invoice: {
          id: h.id,
          number: h.number,
          title: invoiceTitle(h, market),
          status: h.status,
          revision: h.revision,
          issueDate: h.issueDate,
          dueDate: h.dueDate,
          currency: h.currency,
          taxMode: h.taxMode,
          registration: h.registration,
          customer: customer
            ? { name: customer.displayName, company: customer.company, taxId: customer.taxId, addressLines: customer.addressLines }
            : null,
          subtotalMinor: h.subtotalMinor,
          discountTotalMinor: h.discountTotalMinor,
          taxTotalMinor: h.taxTotalMinor,
          totalMinor: h.totalMinor,
          qualifiedDiscount: h.qualifiedDiscount,
          qualifiedDiscountMinor: h.qualifiedDiscountMinor,
          taxWaivedMinor: h.taxWaivedMinor,
          voidReason: h.voidReason,
          cancelReason: h.cancelReason,
        },
        lines: (linesOf.get(h.id) ?? []).map((line) => ({
          position: line.position,
          description: line.description,
          unitLabel: line.unitLabel,
          quantity: numericToQuantity(line.quantity),
          unitPriceMinor: line.unitPriceMinor,
          grossMinor: line.grossMinor,
          discountMinor: line.discountMinor,
          taxRateName: line.taxRateName,
          taxRateBps: line.taxRateBps,
          taxMinor: line.taxMinor,
          totalMinor: line.totalMinor,
          qualifiedDiscountMinor: line.qualifiedDiscountMinor,
          taxWaivedMinor: line.taxWaivedMinor,
        })),
      },
    ];
  });
}
