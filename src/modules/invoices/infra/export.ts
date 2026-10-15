import { asc, eq } from "drizzle-orm";
import type { Executor } from "@/db";
import { invoiceLines, invoiceRegistrations, invoices, recurringScheduleLines, recurringSchedules } from "../schema";

/** Every bill of a business, every bill line, its invoice registration and its recurring schedules with their lines, for "Download your data". */
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
  const schedules = await executor
    .select()
    .from(recurringSchedules)
    .where(eq(recurringSchedules.organizationId, organizationId))
    .orderBy(asc(recurringSchedules.createdAt), asc(recurringSchedules.id));
  const scheduleLines = await executor
    .select()
    .from(recurringScheduleLines)
    .where(eq(recurringScheduleLines.organizationId, organizationId))
    .orderBy(asc(recurringScheduleLines.scheduleId), asc(recurringScheduleLines.position));
  return { invoices: rows, lines, registration: registration ?? null, recurringSchedules: schedules, recurringLines: scheduleLines };
}
