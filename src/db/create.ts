import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Anything that can run a query: the database itself or an open transaction. */
export type Executor = Database | Transaction;

/**
 * Builds a Drizzle database over a node-postgres pool. Kept free of
 * `server-only` so integration tests can create their own instance; app code
 * uses `getDb()` from `@/db` instead.
 */
export function createDatabase(connectionString: string, options: PoolConfig = {}) {
  const pool = new Pool({ connectionString, max: 5, ...options });
  const db: Database = drizzle(pool, { schema });
  return { db, pool };
}
