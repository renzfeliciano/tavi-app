import { formatAddressLines, type MarketProfile, taxIdStatement } from "@/config/markets";
import { type Database, getDb } from "@/db";
import { assertCan, type OrgActor } from "@/modules/authz";
import { buildEInvoice, eInvoiceFile, registeredInvoicesForExport } from "@/modules/invoices";
import { getBusinessProfile } from "@/modules/organizations";
import { taxWithheldByInvoice } from "@/modules/payments";
import type { CalendarDate } from "@/shared/dates/calendar";
import type { ReportPeriod } from "../domain/period";

// E-invoice exports (D19): registered invoices as structured JSON for the
// BIR's Electronic Invoicing System, built from the invoices, the business's
// registered details and the tax buyers withheld. For owners and admins
// (`reports.read`), like the other accountant downloads. The seller is as the
// business profile reads now; TAVI doesn't snapshot it on each invoice.

type Market = Pick<MarketProfile, "documents" | "address" | "taxId" | "taxRegistrations">;

export type EInvoiceExport = ReturnType<typeof eInvoiceFile>;

async function exportFile(
  actor: OrgActor,
  query: { invoiceId: string } | { from: CalendarDate; to: CalendarDate },
  { market, now }: { market: Market; now: Date },
  db: Database,
): Promise<EInvoiceExport> {
  assertCan(actor, "reports.read");
  const [records, profile] = await Promise.all([
    registeredInvoicesForExport(actor, query, { market }, db),
    getBusinessProfile(actor, db),
  ]);
  const withheld = await taxWithheldByInvoice(
    actor,
    records.map((r) => r.invoice.id),
    db,
  );
  const seller = {
    registeredName: profile.legalName ?? profile.name,
    tradeName: profile.legalName && profile.legalName !== profile.name ? profile.name : null,
    taxId: profile.taxId,
    taxIdStatement: profile.taxId ? taxIdStatement(market, profile.taxRegistration) : null,
    addressLines: formatAddressLines(profile, market),
  };
  return eInvoiceFile(
    records.map((record) => buildEInvoice({ ...record, seller, withheldMinor: withheld.get(record.invoice.id) ?? 0 })),
    { generatedAt: now, ...("from" in query ? { period: { from: query.from, to: query.to } } : {}) },
  );
}

/** Every registered invoice issued in the period, void and cancelled ones included (marked). */
export function eInvoicesForPeriod(
  actor: OrgActor,
  { period, market, now = new Date() }: { period: Pick<ReportPeriod, "from" | "to">; market: Market; now?: Date },
  db: Database = getDb(),
): Promise<EInvoiceExport> {
  return exportFile(actor, { from: period.from, to: period.to }, { market, now }, db);
}

/** One registered invoice, or null when it isn't one (a draft, a billing statement, another business's). */
export async function eInvoiceFor(
  actor: OrgActor,
  invoiceId: string,
  { market, now = new Date() }: { market: Market; now?: Date },
  db: Database = getDb(),
): Promise<EInvoiceExport | null> {
  const file = await exportFile(actor, { invoiceId }, { market, now }, db);
  return file.invoices.length > 0 ? file : null;
}
