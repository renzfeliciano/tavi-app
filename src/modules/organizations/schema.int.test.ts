import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestOrganization, resetTables, testDb } from "@/db/testing";
import { organizations } from "./schema";

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("organizations table", () => {
  it("defaults to the Philippines-first settings (D2)", async () => {
    const org = await createTestOrganization();

    expect(org).toMatchObject({
      defaultCurrency: "PHP",
      timezone: "Asia/Manila",
      locale: "en-PH",
      taxMode: "inclusive",
    });
  });

  it("generates time-ordered UUIDv7 ids in the database", async () => {
    const org = await createTestOrganization();
    // Version nibble is the 13th hex digit.
    expect(org.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("rejects a blank business name", async () => {
    await expect(
      testDb().insert(organizations).values({ name: "   " }),
    ).rejects.toMatchObject({
      cause: { code: "23514", constraint: "organizations_name_not_blank" },
    });
  });

  it("rejects a currency that isn't an uppercase ISO code", async () => {
    await expect(
      testDb().insert(organizations).values({ name: "Acme", defaultCurrency: "php" }),
    ).rejects.toMatchObject({
      cause: { code: "23514", constraint: "organizations_currency_iso" },
    });
  });
});
