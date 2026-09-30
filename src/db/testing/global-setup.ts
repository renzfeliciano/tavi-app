import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase } from "../create";
import { testDatabaseUrl } from "./env";

/**
 * Runs once before the integration suite: wipes the test database and applies
 * every migration from scratch, so tests always run against the real schema.
 */
export default async function setup() {
  const { db, pool } = createDatabase(testDatabaseUrl(), { max: 1 });
  try {
    await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("CREATE SCHEMA public");
    await migrate(db, { migrationsFolder: "src/db/migrations" });
  } finally {
    await pool.end();
  }
}
