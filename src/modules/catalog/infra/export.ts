import { asc, eq } from "drizzle-orm";
import type { Executor } from "@/db";
import { products, services, taxRates } from "../schema";

/** A business's tax rates, products and services, archived ones too, for "Download your data". */
export async function exportCatalog(executor: Executor, organizationId: string) {
  const rates = await executor
    .select()
    .from(taxRates)
    .where(eq(taxRates.organizationId, organizationId))
    .orderBy(asc(taxRates.createdAt), asc(taxRates.id));
  const productRows = await executor
    .select()
    .from(products)
    .where(eq(products.organizationId, organizationId))
    .orderBy(asc(products.createdAt), asc(products.id));
  const serviceRows = await executor
    .select()
    .from(services)
    .where(eq(services.organizationId, organizationId))
    .orderBy(asc(services.createdAt), asc(services.id));
  return { taxRates: rates, products: productRows, services: serviceRows };
}
