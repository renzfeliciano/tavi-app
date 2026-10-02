import type { MarketProfile } from "@/config/markets";
import { type Database, getDb } from "@/db";
import { assertCan, type OrgActor } from "@/modules/authz";
import { invoiceParties, invoicesIssuedBetween, unpaidInvoices } from "@/modules/invoices";
import { paymentsReceivedBetween } from "@/modules/payments";
import type { CalendarDate } from "@/shared/dates/calendar";
import type { ReportPeriod } from "../domain/period";
import {
  type PaymentRow,
  type PaymentsSummary,
  type SalesRow,
  type SalesSummary,
  summarizePayments,
  summarizeSales,
  summarizeUnpaid,
  type UnpaidRow,
  type UnpaidSummary,
} from "../domain/summaries";

// The three reports (2.2, D18), for owners and admins (`reports.read`). Each
// asks the module that owns the data for plain rows and sums them in
// `domain/`; the rows also feed the CSV downloads.

type Market = Pick<MarketProfile, "documents">;
type Period = Pick<ReportPeriod, "from" | "to">;

export type Report<Row, Summary> = { rows: Row[]; summaries: Summary[] };

/** Bills issued in the period: sales, their tax, and what was cancelled. */
export async function salesReport(
  actor: OrgActor,
  { period, market }: { period: Period; market: Market },
  db: Database = getDb(),
): Promise<Report<SalesRow, SalesSummary>> {
  assertCan(actor, "reports.read");
  const rows: SalesRow[] = await invoicesIssuedBetween(actor, { from: period.from, to: period.to, market }, db);
  return { rows, summaries: summarizeSales(rows) };
}

/** Money received in the period, by method, and the tax customers withheld. */
export async function paymentsReport(
  actor: OrgActor,
  { period }: { period: Period },
  db: Database = getDb(),
): Promise<Report<PaymentRow, PaymentsSummary>> {
  assertCan(actor, "reports.read");
  const received = await paymentsReceivedBetween(actor, { from: period.from, to: period.to }, db);
  const parties = new Map(
    (await invoiceParties(actor, [...new Set(received.map((payment) => payment.invoiceId))], db)).map((party) => [
      party.id,
      party,
    ]),
  );
  const rows: PaymentRow[] = received.map(({ invoiceId, ...payment }) => {
    const party = parties.get(invoiceId);
    return {
      ...payment,
      invoiceNumber: party?.number ?? null,
      customerId: party?.customerId ?? null,
      customerName: party?.customerName ?? null,
      customerTaxId: party?.customerTaxId ?? null,
    };
  });
  return { rows, summaries: summarizePayments(rows) };
}

/** What's owed today, by how long it's been overdue. */
export async function unpaidReport(
  actor: OrgActor,
  { today, market }: { today: CalendarDate; market: Market },
  db: Database = getDb(),
): Promise<Report<UnpaidRow, UnpaidSummary>> {
  assertCan(actor, "reports.read");
  const rows: UnpaidRow[] = await unpaidInvoices(actor, { market }, db);
  return { rows, summaries: summarizeUnpaid(rows, today) };
}
