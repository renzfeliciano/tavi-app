import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { isCheckViolation, isUniqueViolation } from "@/db/errors";
import { closeTestDb, resetTables, testDb } from "@/db/testing";
import { testBusiness, testCustomer } from "./application/certificate-fixtures";
import { receipts } from "./schema";

// The constraints the database itself keeps for receipts (spec section 4), so no code path can store an impossible one.

beforeEach(async () => {
  await resetTables();
});
afterAll(async () => {
  await closeTestDb();
});

async function setup() {
  const actor = await testBusiness();
  const row = (overrides: Partial<typeof receipts.$inferInsert> = {}): typeof receipts.$inferInsert => ({
    organizationId: actor.organizationId,
    kind: "collection",
    receiptNumber: "REC-000001",
    payerName: "Maria Santos",
    amountMinor: 150_000,
    currency: "PHP",
    receivedOn: "2026-10-01",
    method: "cash",
    purpose: "Reimbursement of fuel",
    seller: null,
    ...overrides,
  });
  const insert = async (overrides: Partial<typeof receipts.$inferInsert> = {}) => {
    const [made] = await testDb().insert(receipts).values(row(overrides)).returning({ id: receipts.id });
    if (!made) throw new Error("receipt");
    return made.id;
  };
  return { actor, row, insert };
}

/** Postgres error 23503, on one named constraint (Drizzle wraps the driver error in `cause`). */
function isForeignKeyViolation(error: unknown, constraint: string): boolean {
  for (let e: unknown = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    const pg = e as { code?: string; constraint?: string };
    if (pg.code === "23503" && pg.constraint === constraint) return true;
  }
  return false;
}

const rejection = async (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error);

describe("receipts", () => {
  it("stores a receipt, with or without a customer", async () => {
    const { actor, insert } = await setup();
    const customerId = await testCustomer(actor);
    await expect(insert()).resolves.toBeTruthy();
    await expect(insert({ receiptNumber: "REC-000002", customerId })).resolves.toBeTruthy();
  });

  it("refuses an amount of zero, a kind that is not one of the two, and a bad time", async () => {
    const { insert } = await setup();
    expect(isCheckViolation(await rejection(insert({ amountMinor: 0 })), "receipts_amount")).toBe(true);
    expect(isCheckViolation(await rejection(insert({ kind: "official" as "collection" })), "receipts_kind")).toBe(true);
    expect(isCheckViolation(await rejection(insert({ paidTime: "25:00" })), "receipts_paid_time")).toBe(true);
  });

  it("refuses a void without a reason", async () => {
    const { insert } = await setup();
    expect(isCheckViolation(await rejection(insert({ voidedAt: new Date() })), "receipts_void_reason")).toBe(true);
    await expect(insert({ receiptNumber: "REC-000009", voidedAt: new Date(), voidReason: "Wrong amount" })).resolves.toBeTruthy();
  });

  it("keeps a receipt number unique inside one business, and lets another business reuse it", async () => {
    const { insert } = await setup();
    await insert();
    expect(isUniqueViolation(await rejection(insert()), "receipts_organization_receipt_unique")).toBe(true);
    const other = await testBusiness();
    await expect(
      testDb().insert(receipts).values({
        organizationId: other.organizationId,
        kind: "acknowledgement",
        receiptNumber: "REC-000001",
        payerName: "Pedro Reyes",
        amountMinor: 1,
        currency: "PHP",
        receivedOn: "2026-10-01",
        method: "cash",
        purpose: "Deposit",
        seller: null,
      }),
    ).resolves.toBeTruthy();
  });

  it("keeps an idempotency key unique inside one business", async () => {
    const { insert } = await setup();
    await insert({ idempotencyKey: "key-1" });
    expect(isUniqueViolation(await rejection(insert({ receiptNumber: "REC-000002", idempotencyKey: "key-1" })), "receipts_organization_idempotency_unique")).toBe(true);
  });

  it("refuses a customer that belongs to another business", async () => {
    const { insert } = await setup();
    const other = await testBusiness();
    const strangerId = await testCustomer(other);
    expect(isForeignKeyViolation(await rejection(insert({ customerId: strangerId })), "receipts_customer_fk")).toBe(true);
  });
});
