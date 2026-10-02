import { asc, eq } from "drizzle-orm";
import type { Executor } from "@/db";
import { invoiceLines, invoiceRegistrations, invoices } from "../schema";

/** Every bill of a business, every bill line and its invoice registration, for "Download your data". */
export async function exportInvoices(executor: Executor, organizationId: string) {
  const rows = await executor
    .select()
    .from(invoices)
    .where(eq(invoices.organizationId, organizationId))
    .orderBy(asc(invoices.createdAt), asc(invoices.id));
  const lines = await executor
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.organizationId, organizationId))
    .orderBy(asc(invoiceLines.invoiceId), asc(invoiceLines.position));
  const [registration] = await executor
    .select()
    .from(invoiceRegistrations)
    .where(eq(invoiceRegistrations.organizationId, organizationId));
  return { invoices: rows, lines, registration: registration ?? null };
}
