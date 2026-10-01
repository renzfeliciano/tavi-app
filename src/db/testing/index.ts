import { asc, sql } from "drizzle-orm";
import { DEFAULT_MARKET, MARKETS } from "@/config/markets";
import { createDatabase, type Database } from "../create";
import { auditEvents, memberships, organizations, outboxMessages, users } from "../schema";
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

/** A new business's market-derived columns, as onboarding would set them. */
function marketDefaults() {
  const market = MARKETS[DEFAULT_MARKET];
  return {
    countryCode: market.country,
    defaultCurrency: market.currency,
    locale: market.locale,
    timezone: market.timezone,
    taxMode: market.defaultTaxMode,
    quoteValidityDays: market.quoteValidityDays,
    paymentTermsDays: market.paymentTermsDays,
  };
}

export async function createTestOrganization(
  db: Database = testDb(),
  overrides: Partial<typeof organizations.$inferInsert> = {},
) {
  const [org] = await db
    .insert(organizations)
    .values({ ...marketDefaults(), name: "Acme Aircon Services", ...overrides })
    .returning();
  if (!org) throw new Error("Failed to create test organization");
  return org;
}

export async function createTestUser(
  db: Database = testDb(),
  overrides: Partial<typeof users.$inferInsert> = {},
) {
  const [user] = await db
    .insert(users)
    .values({ name: "Maria Santos", email: "maria@example.com", ...overrides })
    .returning();
  if (!user) throw new Error("Failed to create test user");
  return user;
}

/** Makes a user a member of a business. */
export async function addTestMembership(
  db: Database,
  membership: { organizationId: string; userId: string; role: "owner" | "admin" | "member" },
) {
  await db.insert(memberships).values(membership);
}

/** Every audit event in insertion order (tests only; the app reads per tenant). */
export async function listAllAuditEvents(db: Database = testDb()) {
  return db.select().from(auditEvents).orderBy(asc(auditEvents.createdAt), asc(auditEvents.id));
}

/** Every queued outbox message in insertion order (tests only). */
/** Queues `count` placeholder emails for a business, e.g. to reach its email limit. */
export async function fillTestOutbox(organizationId: string, count: number, db: Database = testDb()) {
  if (count <= 0) return;
  await db.insert(outboxMessages).values(
    Array.from({ length: count }, (_, i) => ({
      kind: "email" as const,
      organizationId,
      payload: { to: `customer${i}@example.com`, subject: "Earlier email", text: "…" },
    })),
  );
}

export async function listAllOutboxMessages(db: Database = testDb()) {
  return db.select().from(outboxMessages).orderBy(asc(outboxMessages.createdAt), asc(outboxMessages.id));
}
