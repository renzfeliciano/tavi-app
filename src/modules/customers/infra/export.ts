import { asc, eq } from "drizzle-orm";
import type { Executor } from "@/db";
import { customers } from "../schema";

/** Every customer of a business, archived ones too, for "Download your data". */
export async function exportCustomers(executor: Executor, organizationId: string) {
  return executor
    .select()
    .from(customers)
    .where(eq(customers.organizationId, organizationId))
    .orderBy(asc(customers.createdAt), asc(customers.id));
}
