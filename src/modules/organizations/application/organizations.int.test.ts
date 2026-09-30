import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeTestDb, createTestUser, resetTables, testDb } from "@/db/testing";
import { MARKETS } from "@/config/markets";
import { listAuditEvents } from "@/modules/audit";
import { memberships } from "../schema";
import { createOrganizationForUser, resolveMembership } from "./organizations";

const createUser = (email = "maria@example.com") => createTestUser(testDb(), { email });

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("createOrganizationForUser", () => {
  it("creates the business and makes the user its owner", async () => {
    const user = await createUser();

    const result = await createOrganizationForUser(
      user.id,
      { name: "  Acme Aircon Services  ", currency: "PHP" },
      testDb(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.organization).toMatchObject({ name: "Acme Aircon Services", defaultCurrency: "PHP" });
    const rows = await testDb().select().from(memberships).where(eq(memberships.userId, user.id));
    expect(rows).toEqual([
      expect.objectContaining({ organizationId: result.organization.id, role: "owner" }),
    ]);
    expect(await listAuditEvents(result.organization.id, testDb())).toEqual([
      expect.objectContaining({
        action: "organization.created",
        actorType: "user",
        actorId: user.id,
        entityType: "organization",
        entityId: result.organization.id,
      }),
    ]);
  });

  it("sets the business up from its country's market profile", async () => {
    const user = await createUser();

    const result = await createOrganizationForUser(
      user.id,
      { name: "Acme", currency: "USD", country: "PH" },
      testDb(),
    );

    const ph = MARKETS.PH;
    expect(result).toMatchObject({
      ok: true,
      organization: {
        countryCode: "PH",
        // The owner's choice wins over the market's usual currency.
        defaultCurrency: "USD",
        locale: ph.locale,
        timezone: ph.timezone,
        taxMode: ph.defaultTaxMode,
        quoteValidityDays: ph.quoteValidityDays,
        paymentTermsDays: ph.paymentTermsDays,
      },
    });
  });

  it("refuses a country TAVI has no market profile for", async () => {
    const user = await createUser();

    const result = await createOrganizationForUser(
      user.id,
      { name: "Acme", currency: "PHP", country: "ZZ" },
      testDb(),
    );

    expect(result).toEqual({ ok: false, fieldErrors: { country: ["Choose a country."] } });
  });

  it("returns field errors instead of throwing for invalid input", async () => {
    const user = await createUser();

    const result = await createOrganizationForUser(user.id, { name: " ", currency: "XYZ" }, testDb());

    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        name: ["Enter your business name."],
        currency: ["Choose a currency."],
      },
    });
  });
});

describe("resolveMembership", () => {
  it("returns the session's active organization when the user belongs to it", async () => {
    const user = await createUser();
    const first = await createOrganizationForUser(user.id, { name: "First", currency: "PHP" }, testDb());
    const second = await createOrganizationForUser(user.id, { name: "Second", currency: "USD" }, testDb());
    if (!first.ok || !second.ok) throw new Error("setup");

    const membership = await resolveMembership(user.id, second.organization.id, testDb());

    expect(membership).toMatchObject({ organizationId: second.organization.id, organizationName: "Second", role: "owner" });
  });

  it("falls back to the user's oldest membership when there is no active one", async () => {
    const user = await createUser();
    const first = await createOrganizationForUser(user.id, { name: "First", currency: "PHP" }, testDb());
    await createOrganizationForUser(user.id, { name: "Second", currency: "PHP" }, testDb());
    if (!first.ok) throw new Error("setup");

    expect((await resolveMembership(user.id, null, testDb()))?.organizationId).toBe(first.organization.id);
  });

  it("never grants access to an organization the user doesn't belong to (IDOR)", async () => {
    const maria = await createUser("maria@example.com");
    const juan = await createUser("juan@example.com");
    const juansOrg = await createOrganizationForUser(juan.id, { name: "Juan's", currency: "PHP" }, testDb());
    const mariasOrg = await createOrganizationForUser(maria.id, { name: "Maria's", currency: "PHP" }, testDb());
    if (!juansOrg.ok || !mariasOrg.ok) throw new Error("setup");

    // A tampered or stale active organization falls back to Maria's own.
    const membership = await resolveMembership(maria.id, juansOrg.organization.id, testDb());

    expect(membership?.organizationId).toBe(mariasOrg.organization.id);
  });

  it("returns null for a user with no organization yet", async () => {
    const user = await createUser();
    expect(await resolveMembership(user.id, null, testDb())).toBeNull();
  });
});
