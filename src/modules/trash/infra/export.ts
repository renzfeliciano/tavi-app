import { asc, eq } from "drizzle-orm";
import type { Executor } from "@/db";
import { trashItems } from "../schema";

/** What is waiting in a business's recycle bin (lapsed items the daily job hasn't removed yet included), for "Download your data". */
export async function exportTrash(executor: Executor, organizationId: string) {
  return executor
    .select({
      kind: trashItems.kind,
      originalId: trashItems.originalId,
      customerName: trashItems.customerName,
      totalMinor: trashItems.totalMinor,
      currency: trashItems.currency,
      deletedAt: trashItems.deletedAt,
      expiresAt: trashItems.expiresAt,
      payload: trashItems.payload,
    })
    .from(trashItems)
    .where(eq(trashItems.organizationId, organizationId))
    .orderBy(asc(trashItems.deletedAt), asc(trashItems.id));
}
