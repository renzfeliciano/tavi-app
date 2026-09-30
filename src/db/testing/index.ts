import { sql } from "drizzle-orm";
import { createDatabase, type Database } from "../create";
import { organizations } from "../schema";
import { testDatabaseUrl } from "./env";

let shared: ReturnType<typeof createDatabase> | undefined;

/** One pool per test file (files run one at a time). */
export function testDb(): Database {
  shared ??= createDatabase(testDatabaseUrl(), { max: 10 });
  return shared.db;
}

export async function closeTestDb(): Promise<void> {
  await shared?.pool.end();
  shared = undefined;
}

/** Empties every table so each test starts from a clean database. */
export async function resetTables(db: Database = testDb()): Promise<void> {
  const { rows } = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  if (rows.length === 0) return;
  const tables = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await db.execute(sql.raw(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`));
}

export async function createTestOrganization(
  db: Database = testDb(),
  overrides: Partial<typeof organizations.$inferInsert> = {},
) {
  const [org] = await db
    .insert(organizations)
    .values({ name: "Acme Aircon Services", ...overrides })
    .returning();
  if (!org) throw new Error("Failed to create test organization");
  return org;
}
