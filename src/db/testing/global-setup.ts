import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase } from "../create";
import { testDatabaseUrl } from "./env";

/**
 * Neon's free tier suspends idle branches; the first connection can drop while
 * the compute wakes. Retry a few times before giving up.
 */
async function waitForDatabase(pool: { query: (sql: string) => Promise<unknown> }) {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query("select 1");
      return;
    } catch (error) {
      if (attempt >= 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
}

/**
 * Runs once before the integration suite: wipes the test database and applies
 * every migration from scratch, so tests always run against the real schema.
 */
export default async function setup() {
  const { db, pool } = createDatabase(testDatabaseUrl(), { max: 1 });
  try {
    await waitForDatabase(pool);
    await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("CREATE SCHEMA public");
    await migrate(db, { migrationsFolder: "src/db/migrations" });
  } finally {
    await pool.end();
  }
}
