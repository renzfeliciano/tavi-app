import { asc, eq } from "drizzle-orm";
import type { Executor } from "@/db";
import { purchaseOrderLines, purchaseOrders, suppliers } from "../schema";

/** Every supplier of a business (archived too), every purchase order and every order line, for "Download your data". */
export async function exportPurchasing(executor: Executor, organizationId: string) {
  const supplierRows = await executor
    .select()
    .from(suppliers)
    .where(eq(suppliers.organizationId, organizationId))
    .orderBy(asc(suppliers.createdAt), asc(suppliers.id));
  const orders = await executor
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.organizationId, organizationId))
    .orderBy(asc(purchaseOrders.createdAt), asc(purchaseOrders.id));
  const lines = await executor
    .select()
    .from(purchaseOrderLines)
    .where(eq(purchaseOrderLines.organizationId, organizationId))
    .orderBy(asc(purchaseOrderLines.purchaseOrderId), asc(purchaseOrderLines.position));
  return { suppliers: supplierRows, orders, lines };
}
