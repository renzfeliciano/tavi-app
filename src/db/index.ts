import "server-only";
import { env } from "@/shared/env";
import { createDatabase, type Database } from "./create";

export type { Database, Executor, Transaction } from "./create";
export { isUniqueViolation } from "./errors";

// One pool per server process. In development the module is re-evaluated on
// every hot reload, so the instance is parked on globalThis to avoid leaking
// connections to Neon.
const globalForDb = globalThis as unknown as { taviDb?: Database };

/** The app's database. Throws a readable error if DATABASE_URL is missing. */
export function getDb(): Database {
  if (globalForDb.taviDb) return globalForDb.taviDb;
  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and add the Neon `dev` branch connection string.",
    );
  }
  const { db } = createDatabase(env.DATABASE_URL);
  globalForDb.taviDb = db;
  return db;
}
