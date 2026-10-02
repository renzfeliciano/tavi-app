import { asc, eq } from "drizzle-orm";
import type { Executor } from "@/db";
import { payments } from "../schema";

/** Every payment of a business, voided ones too, for "Download your data". */
export async function exportPayments(executor: Executor, organizationId: string) {
  return executor
    .select()
    .from(payments)
    .where(eq(payments.organizationId, organizationId))
    .orderBy(asc(payments.createdAt), asc(payments.id));
}
