import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestOrganization, resetTables, testDb } from "@/db/testing";
import { MARKETS } from "@/config/markets";
import { newOrganizationValues } from "./application/organizations";
import { organizations } from "./schema";

const acme = (overrides: Partial<typeof organizations.$inferInsert> = {}) => ({
  ...newOrganizationValues({ name: "Acme", currency: "PHP", country: "PH" }),
  ...overrides,
});

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("organizations table", () => {
  it("takes a new business's settings from its market profile", async () => {
    const [org] = await testDb().insert(organizations).values(acme()).returning();

    const ph = MARKETS.PH;
    expect(org).toMatchObject({
      countryCode: "PH",
      defaultCurrency: "PHP",
      timezone: ph.timezone,
      locale: ph.locale,
      taxMode: ph.defaultTaxMode,
      quoteValidityDays: ph.quoteValidityDays,
      paymentTermsDays: ph.paymentTermsDays,
    });
  });

  it("has no market-specific column defaults: the country must be given", async () => {
    await expect(
      testDb().insert(organizations).values({ ...acme(), countryCode: undefined as unknown as string }),
    ).rejects.toMatchObject({ cause: { code: "23502", column: "country_code" } });
  });

  it("rejects a country that isn't an uppercase ISO code", async () => {
    await expect(testDb().insert(organizations).values(acme({ countryCode: "ph" }))).rejects.toMatchObject({
      cause: { code: "23514", constraint: "organizations_country_iso" },
    });
  });

  it("generates time-ordered UUIDv7 ids in the database", async () => {
    const org = await createTestOrganization();
    // Version nibble is the 13th hex digit.
    expect(org.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("rejects a blank business name", async () => {
    await expect(
      testDb().insert(organizations).values(acme({ name: "   " })),
    ).rejects.toMatchObject({
      cause: { code: "23514", constraint: "organizations_name_not_blank" },
    });
  });

  it("rejects a currency that isn't an uppercase ISO code", async () => {
    await expect(
      testDb().insert(organizations).values(acme({ defaultCurrency: "php" })),
    ).rejects.toMatchObject({
      cause: { code: "23514", constraint: "organizations_currency_iso" },
    });
  });
});
