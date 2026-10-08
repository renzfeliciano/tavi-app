import { and, eq, gte, inArray, lte, notInArray, sql } from "drizzle-orm";
import type { MarketProfile } from "@/config/markets";
import { type Database, getDb } from "@/db";
import { assertCan, type OrgActor } from "@/modules/authz";
import type { CalendarDate } from "@/shared/dates/calendar";
import { invoiceTitle } from "../domain/registration";
import { salesBreakdown } from "../domain/sales-breakdown";
import { type InvoiceStatus, OWING_INVOICE_STATUSES } from "../domain/status";
import { invoiceLines, invoices } from "../schema";

// What the reports ask of invoices (2.2, D18). A bill counts on its issue
// date. Drafts were never issued and void bills never happened (D6), so
// neither appears; cancelled bills come back flagged, as cancelled revenue.

type Market = Pick<MarketProfile, "documents">;

const customerName = sql<string | null>`${invoices.customerSnapshot}->>'displayName'`;
const customerTaxId = sql<string | null>`${invoices.customerSnapshot}->>'taxId'`;

export type ReportedInvoice = {
  id: string;
  number: string;
  /** As issued: the market's name for a bill, or the registered invoice's title. */
  title: string;
  registered: boolean;
  issueDate: CalendarDate;
  dueDate: CalendarDate;
  status: InvoiceStatus;
  cancelled: boolean;
  customerId: string | null;
  customerName: string | null;
  customerTaxId: string | null;
  currency: string;
  totalMinor: number;
  taxMinor: number;
  paidMinor: number;
  /**
   * Its lines by tax treatment, the `salesBreakdown` rule, before any
   * qualified discount: they add up to the total plus that discount.
   */
  vatableMinor: number;
  vatMinor: number;
  zeroRatedMinor: number;
  exemptMinor: number;
  /** A qualified buyer's discount (D19; PH: senior citizen, PWD, …), 0 without one. */
  qualifiedDiscountMinor: number;
};

/** Bills issued from `from` to `to` (both included), oldest first. */
export async function invoicesIssuedBetween(
  actor: OrgActor,
  { from, to, market }: { from: CalendarDate; to: CalendarDate; market: Market },
  db: Database = getDb(),
): Promise<ReportedInvoice[]> {
  assertCan(actor, "invoices.read");
  const issued = and(
    eq(invoices.organizationId, actor.organizationId),
    notInArray(invoices.status, ["DRAFT", "VOID"]),
    gte(invoices.issueDate, from),
    lte(invoices.issueDate, to),
  );
  const [rows, lines] = await Promise.all([
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        registration: invoices.registration,
        status: invoices.status,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        customerId: invoices.customerId,
        customerName,
        customerTaxId,
        currency: invoices.currency,
        totalMinor: invoices.totalMinor,
        taxMinor: invoices.taxTotalMinor,
        paidMinor: invoices.amountPaidMinor,
        qualifiedDiscountMinor: invoices.qualifiedDiscountMinor,
        taxExemptSale: sql<boolean>`coalesce((${invoices.qualifiedDiscount}->>'taxExempt')::boolean, false)`,
      })
      .from(invoices)
      .where(issued)
      .orderBy(invoices.issueDate, invoices.number),
    db
      .select({
        invoiceId: invoiceLines.invoiceId,
        rateBps: invoiceLines.taxRateBps,
        taxMinor: invoiceLines.taxMinor,
        totalMinor: invoiceLines.totalMinor,
        qualifiedDiscountMinor: invoiceLines.qualifiedDiscountMinor,
      })
      .from(invoiceLines)
      .innerJoin(
        invoices,
        and(eq(invoiceLines.organizationId, invoices.organizationId), eq(invoiceLines.invoiceId, invoices.id)),
      )
      .where(issued),
  ]);
  const linesOf = Map.groupBy(lines, (line) => line.invoiceId);
  return rows.map(({ registration, number, taxExemptSale, ...row }) => {
    const breakdown = salesBreakdown("vat", linesOf.get(row.id) ?? [], { taxExemptSale });
    const sums =
      breakdown.kind === "vat" ? breakdown : { vatableMinor: 0, vatMinor: 0, zeroRatedMinor: 0, exemptMinor: 0 };
    return {
      ...row,
      number: number ?? "",
      title: invoiceTitle({ registration }, market),
      registered: registration !== null,
      cancelled: row.status === "CANCELLED",
      vatableMinor: sums.vatableMinor,
      vatMinor: sums.vatMinor,
      zeroRatedMinor: sums.zeroRatedMinor,
      exemptMinor: sums.exemptMinor,
    };
  });
}

export type UnpaidInvoice = Pick<
  ReportedInvoice,
  "id" | "number" | "title" | "issueDate" | "dueDate" | "status" | "customerId" | "customerName" | "currency" | "totalMinor" | "paidMinor"
>;

/** Every sent bill still owed, soonest due first. */
export async function unpaidInvoices(
  actor: OrgActor,
  { market }: { market: Market },
  db: Database = getDb(),
): Promise<UnpaidInvoice[]> {
  assertCan(actor, "invoices.read");
  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      registration: invoices.registration,
      status: invoices.status,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      customerId: invoices.customerId,
      customerName,
      currency: invoices.currency,
      totalMinor: invoices.totalMinor,
      paidMinor: invoices.amountPaidMinor,
    })
    .from(invoices)
    .where(and(eq(invoices.organizationId, actor.organizationId), inArray(invoices.status, [...OWING_INVOICE_STATUSES])))
    .orderBy(invoices.dueDate, invoices.number);
  return rows.map(({ registration, number, ...row }) => ({
    ...row,
    number: number ?? "",
    title: invoiceTitle({ registration }, market),
  }));
}

export type InvoiceParty = {
  id: string;
  number: string | null;
  customerId: string | null;
  customerName: string | null;
  customerTaxId: string | null;
};

/** Who each of these bills was for, for reports that start from something else (payments). */
export async function invoiceParties(
  actor: OrgActor,
  invoiceIds: readonly string[],
  db: Database = getDb(),
): Promise<InvoiceParty[]> {
  assertCan(actor, "invoices.read");
  if (invoiceIds.length === 0) return [];
  return db
    .select({ id: invoices.id, number: invoices.number, customerId: invoices.customerId, customerName, customerTaxId })
    .from(invoices)
    .where(and(eq(invoices.organizationId, actor.organizationId), inArray(invoices.id, [...invoiceIds])));
}
