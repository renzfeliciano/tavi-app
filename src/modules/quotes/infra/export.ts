import { asc, eq } from "drizzle-orm";
import type { Executor } from "@/db";
import { quoteLines, quotes } from "../schema";

/** Every quote of a business and every quote line, for "Download your data". */
export async function exportQuotes(executor: Executor, organizationId: string) {
  const rows = await executor
    .select()
    .from(quotes)
    .where(eq(quotes.organizationId, organizationId))
    .orderBy(asc(quotes.createdAt), asc(quotes.id));
  const lines = await executor
    .select()
    .from(quoteLines)
    .where(eq(quoteLines.organizationId, organizationId))
    .orderBy(asc(quoteLines.quoteId), asc(quoteLines.position));
  return { quotes: rows, lines };
}
