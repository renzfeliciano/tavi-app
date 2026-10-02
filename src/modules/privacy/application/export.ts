import "server-only";
import { getDb, type Database } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import { assertCan, type OrgActor } from "@/modules/authz";
import { exportCatalog } from "@/modules/catalog";
import { exportCustomers } from "@/modules/customers";
import { getAccountForExport } from "@/modules/identity";
import { exportInvoices } from "@/modules/invoices";
import { exportTeam, getOrganizationForExport } from "@/modules/organizations";
import { exportPayments } from "@/modules/payments";
import { exportQuotes } from "@/modules/quotes";
import { consumeRateLimit } from "@/modules/system";
import { todayIn } from "@/shared/dates/calendar";
import {
  attachLines,
  EXPORT_FORMAT,
  EXPORT_NOTES,
  EXPORT_RATE_LIMIT,
  EXPORT_VERSION,
  exportFileName,
  serializeExport,
} from "../domain/export";

export type ExportResult =
  | { ok: true; fileName: string; body: string }
  | { ok: false; error: "rate_limited"; retryAfterSeconds: number };

/**
 * Everything the business keeps in Tavi, as one JSON file: the business
 * profile, the person's own account, tax rates, products, services,
 * customers, quotes and bills with their lines, and payments. Read in one
 * repeatable-read transaction so the file is a consistent snapshot. Customer
 * link tokens, logos and the activity history aren't included.
 */
export async function exportBusinessData(
  actor: OrgActor & { timezone: string },
  db: Database = getDb(),
  now: Date = new Date(),
): Promise<ExportResult> {
  assertCan(actor, "organization.manage");
  const limit = await consumeRateLimit(`export:${actor.userId}`, EXPORT_RATE_LIMIT, db, now);
  if (!limit.allowed) return { ok: false, error: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds };

  const data = await db.transaction(
    async (tx) => {
      const organizationId = actor.organizationId;
      const business = await getOrganizationForExport(tx, organizationId);
      const account = await getAccountForExport(tx, actor.userId);
      const catalog = await exportCatalog(tx, organizationId);
      const customers = await exportCustomers(tx, organizationId);
      const quotes = await exportQuotes(tx, organizationId);
      const invoices = await exportInvoices(tx, organizationId);
      const payments = await exportPayments(tx, organizationId);
      const team = await exportTeam(tx, organizationId);

      await recordAuditEvent(tx, {
        action: "organization.exported",
        actorType: "user",
        actorId: actor.userId,
        organizationId,
        entityType: "organization",
        entityId: organizationId,
      });

      return {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        exportedAt: now,
        notes: EXPORT_NOTES,
        account,
        business,
        team,
        invoiceRegistration: invoices.registration,
        taxRates: catalog.taxRates,
        products: catalog.products,
        services: catalog.services,
        customers,
        quotes: attachLines(quotes.quotes, quotes.lines, (line) => line.quoteId),
        invoices: attachLines(invoices.invoices, invoices.lines, (line) => line.invoiceId),
        payments,
      };
    },
    { isolationLevel: "repeatable read" },
  );

  return { ok: true, fileName: exportFileName(todayIn(actor.timezone, now)), body: serializeExport(data) };
}
