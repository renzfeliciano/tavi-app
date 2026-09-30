import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  closeTestDb,
  createTestOrganization,
  createTestUser,
  listAllAuditEvents,
  resetTables,
  testDb,
} from "@/db/testing";
import { ForbiddenError, type OrgActor, type Role } from "@/modules/authz";
import {
  archiveTaxRate,
  createTaxRate,
  listTaxRates,
  restoreTaxRate,
  setDefaultTaxRate,
  updateTaxRate,
} from "./tax-rates";

async function actorFor(role: Role = "owner", name = "Acme Aircon Services"): Promise<OrgActor> {
  const org = await createTestOrganization(testDb(), { name });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com` });
  return { organizationId: org.id, userId: user.id, role };
}

async function create(actor: OrgActor, name: string, rate: string) {
  const result = await createTaxRate(actor, { name, rate }, testDb());
  if (!result.ok) throw new Error(`create failed: ${JSON.stringify(result)}`);
  return result.taxRate;
}

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("createTaxRate", () => {
  it("stores the rate in basis points and audits it", async () => {
    const actor = await actorFor();

    const taxRate = await create(actor, " VAT ", "12");

    expect(taxRate).toMatchObject({ name: "VAT", rateBps: 1200, isDefault: false, archivedAt: null });
    expect(await listAllAuditEvents(testDb())).toEqual([
      expect.objectContaining({
        action: "tax_rate.created",
        entityType: "tax_rate",
        entityId: taxRate.id,
        organizationId: actor.organizationId,
        metadata: { name: "VAT", rateBps: 1200 },
      }),
    ]);
  });

  it("makes the first rate the default", async () => {
    const actor = await actorFor();

    const result = await createTaxRate(actor, { name: "VAT", rate: "12", makeDefault: true }, testDb());

    expect(result).toMatchObject({ ok: true, taxRate: { isDefault: true } });
  });

  it("refuses a second active rate with the same name, ignoring case", async () => {
    const actor = await actorFor();
    await create(actor, "VAT", "12");

    const result = await createTaxRate(actor, { name: "vat", rate: "5" }, testDb());

    expect(result).toEqual({ ok: false, fieldErrors: { name: ["You already have a tax called vat."] } });
  });

  it("allows the same name in another organization", async () => {
    await create(await actorFor("owner", "One"), "VAT", "12");

    const result = await createTaxRate(await actorFor("owner", "Two"), { name: "VAT", rate: "12" }, testDb());

    expect(result.ok).toBe(true);
  });

  it("returns field errors for invalid input", async () => {
    const actor = await actorFor();

    const result = await createTaxRate(actor, { name: "", rate: "101" }, testDb());

    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        name: ["Give this tax a name, e.g. VAT."],
        rate: ["Enter a percentage from 0 to 100, with up to 2 decimals."],
      },
    });
  });

  it("refuses members", async () => {
    const actor = await actorFor("member");

    await expect(createTaxRate(actor, { name: "VAT", rate: "12" }, testDb())).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("listTaxRates", () => {
  it("lists the organization's rates, default first, then by name; members may read", async () => {
    const actor = await actorFor();
    await create(actor, "Percentage tax", "3");
    const vat = await create(actor, "VAT", "12");
    await setDefaultTaxRate(actor, vat.id, testDb());
    const other = await actorFor("owner", "Other");
    await create(other, "Other tax", "1");

    const rates = await listTaxRates({ ...actor, role: "member" }, testDb());

    expect(rates.map((r) => [r.name, r.isDefault])).toEqual([
      ["VAT", true],
      ["Percentage tax", false],
    ]);
  });
});

describe("updateTaxRate", () => {
  it("renames and re-rates, auditing before and after", async () => {
    const actor = await actorFor();
    const vat = await create(actor, "VAT", "12");

    const result = await updateTaxRate(actor, vat.id, { name: "VAT (12%)", rate: "12.5" }, testDb());

    expect(result).toMatchObject({ ok: true, taxRate: { name: "VAT (12%)", rateBps: 1250 } });
    expect((await listAllAuditEvents(testDb())).at(-1)).toMatchObject({
      action: "tax_rate.updated",
      entityId: vat.id,
      metadata: { before: { name: "VAT", rateBps: 1200 }, after: { name: "VAT (12%)", rateBps: 1250 } },
    });
  });

  it("treats another organization's rate as not found", async () => {
    const owner = await actorFor("owner", "One");
    const vat = await create(owner, "VAT", "12");
    const intruder = await actorFor("owner", "Two");

    const result = await updateTaxRate(intruder, vat.id, { name: "Hacked", rate: "0" }, testDb());

    expect(result).toEqual({ ok: false, notFound: true });
    expect((await listTaxRates(owner, testDb()))[0]).toMatchObject({ name: "VAT", rateBps: 1200 });
  });
});

describe("setDefaultTaxRate", () => {
  it("moves the default from one rate to another, or clears it", async () => {
    const actor = await actorFor();
    const vat = await create(actor, "VAT", "12");
    const pt = await create(actor, "Percentage tax", "3");

    await setDefaultTaxRate(actor, vat.id, testDb());
    await setDefaultTaxRate(actor, pt.id, testDb());
    expect((await listTaxRates(actor, testDb())).filter((r) => r.isDefault).map((r) => r.name)).toEqual([
      "Percentage tax",
    ]);

    await setDefaultTaxRate(actor, null, testDb());
    expect((await listTaxRates(actor, testDb())).some((r) => r.isDefault)).toBe(false);
  });

  it("can't make another organization's rate the default", async () => {
    const owner = await actorFor("owner", "One");
    const vat = await create(owner, "VAT", "12");
    const intruder = await actorFor("owner", "Two");

    expect(await setDefaultTaxRate(intruder, vat.id, testDb())).toEqual({ ok: false, notFound: true });
    expect((await listTaxRates(owner, testDb()))[0]?.isDefault).toBe(false);
  });
});

describe("archiveTaxRate / restoreTaxRate", () => {
  it("archives (dropping the default) and restores a rate", async () => {
    const actor = await actorFor();
    const vat = await create(actor, "VAT", "12");
    await setDefaultTaxRate(actor, vat.id, testDb());

    expect(await archiveTaxRate(actor, vat.id, testDb())).toEqual({ ok: true });
    const [archived] = await listTaxRates(actor, testDb());
    expect(archived).toMatchObject({ isDefault: false, archivedAt: expect.any(Date) });

    expect(await restoreTaxRate(actor, vat.id, testDb())).toEqual({ ok: true });
    expect((await listTaxRates(actor, testDb()))[0]).toMatchObject({ archivedAt: null, isDefault: false });
    expect((await listAllAuditEvents(testDb())).map((e) => e.action)).toEqual([
      "tax_rate.created",
      "tax_rate.default_changed",
      "tax_rate.archived",
      "tax_rate.restored",
    ]);
  });

  it("won't restore a rate whose name is now taken", async () => {
    const actor = await actorFor();
    const old = await create(actor, "VAT", "12");
    await archiveTaxRate(actor, old.id, testDb());
    await create(actor, "VAT", "12");

    expect(await restoreTaxRate(actor, old.id, testDb())).toEqual({
      ok: false,
      error: "You already have a tax called VAT. Rename it first.",
    });
  });
});
