import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  closeTestDb,
  createTestOrganization,
  createTestUser,
  listAllAuditEvents,
  resetTables,
  testDb,
} from "@/db/testing";
import type { OrgActor, Role } from "@/modules/authz";
import type { CatalogItemKind } from "../domain/catalog-item";
import {
  archiveCatalogItem,
  createCatalogItem,
  getCatalogItem,
  listCatalogItems,
  restoreCatalogItem,
  searchLineSources,
  updateCatalogItem,
} from "./catalog-items";
import { archiveTaxRate, createTaxRate } from "./tax-rates";

const OPTIONS = { locale: "en-PH", units: { product: "pc", service: "hour" } };

async function actorFor(role: Role = "member", name = "Acme"): Promise<OrgActor> {
  const org = await createTestOrganization(testDb(), { name });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com` });
  return { organizationId: org.id, userId: user.id, role };
}

const item = (overrides: Record<string, string> = {}) => ({
  name: "Aircon cleaning",
  description: "",
  sku: "",
  unitLabel: "unit",
  unitPrice: "1,500",
  currency: "PHP",
  taxRateId: "",
  ...overrides,
});

async function add(actor: OrgActor, kind: CatalogItemKind, overrides: Record<string, string> = {}) {
  const result = await createCatalogItem(actor, kind, item(overrides), OPTIONS, testDb());
  if (!result.ok) throw new Error(`create failed: ${JSON.stringify(result)}`);
  return result.item;
}

async function vat(actor: OrgActor) {
  const result = await createTaxRate({ ...actor, role: "owner" }, { name: "VAT", rate: "12" }, { locale: "en-PH" }, testDb());
  if (!result.ok) throw new Error("tax rate");
  return result.taxRate;
}

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("createCatalogItem", () => {
  it("adds a product with its price in minor units and a default tax rate, and audits it", async () => {
    const actor = await actorFor("member");
    const rate = await vat(actor);

    const product = await add(actor, "product", {
      name: "Cleaning kit",
      sku: "ACK-01",
      unitLabel: "set",
      unitPrice: "1,250.50",
      taxRateId: rate.id,
    });

    expect(product).toMatchObject({
      kind: "product",
      name: "Cleaning kit",
      sku: "ACK-01",
      unitPriceMinor: 125_050,
      currency: "PHP",
      taxRateId: rate.id,
      archivedAt: null,
    });
    expect((await listAllAuditEvents(testDb())).at(-1)).toMatchObject({
      action: "product.created",
      entityType: "product",
      entityId: product.id,
      metadata: { name: "Cleaning kit", unitPriceMinor: 125_050, currency: "PHP" },
    });
  });

  it("adds a service, which has no SKU", async () => {
    const actor = await actorFor();

    const service = await add(actor, "service", { name: "Aircon cleaning", unitLabel: "hour", sku: "IGNORED" });

    expect(service).toMatchObject({ kind: "service", name: "Aircon cleaning", sku: null });
  });

  it("refuses a SKU another product already uses, ignoring case", async () => {
    const actor = await actorFor();
    await add(actor, "product", { name: "Kit", sku: "ACK-01" });

    const result = await createCatalogItem(actor, "product", item({ name: "Other", sku: "ack-01" }), OPTIONS, testDb());

    expect(result).toEqual({ ok: false, fieldErrors: { sku: ["Another product already uses SKU ack-01."] } });
  });

  it("only accepts the business's own, active tax rates", async () => {
    const actor = await actorFor();
    const other = await actorFor("owner", "Other");
    const foreignRate = await vat(other);
    const archivedRate = await vat(actor);
    await archiveTaxRate({ ...actor, role: "owner" }, archivedRate.id, testDb());

    for (const taxRateId of [foreignRate.id, archivedRate.id]) {
      expect(await createCatalogItem(actor, "service", item({ taxRateId }), OPTIONS, testDb())).toEqual({
        ok: false,
        fieldErrors: { taxRateId: ["Choose a tax rate from the list."] },
      });
    }
  });

  it("returns field errors for invalid input", async () => {
    const actor = await actorFor();

    expect(await createCatalogItem(actor, "service", item({ name: "", unitPrice: "abc" }), OPTIONS, testDb())).toEqual({
      ok: false,
      fieldErrors: { name: ["Enter a name."] },
    });
  });
});

describe("listCatalogItems", () => {
  it("lists one kind at a time, by name, searching name, description and SKU", async () => {
    const actor = await actorFor();
    await add(actor, "product", { name: "Filter", sku: "FLT-9" });
    await add(actor, "product", { name: "Coil cleaner", description: "For split-type units" });
    await add(actor, "service", { name: "Aircon cleaning" });
    await add(await actorFor("owner", "Other"), "product", { name: "Someone else's filter" });

    const names = async (kind: CatalogItemKind, search?: string) =>
      (await listCatalogItems(actor, kind, { search }, testDb())).items.map((i) => i.name);

    expect(await names("product")).toEqual(["Coil cleaner", "Filter"]);
    expect(await names("service")).toEqual(["Aircon cleaning"]);
    expect(await names("product", "flt")).toEqual(["Filter"]);
    expect(await names("product", "split")).toEqual(["Coil cleaner"]);
  });

  it("shows archived items separately", async () => {
    const actor = await actorFor();
    const old = await add(actor, "service", { name: "Old service" });
    await add(actor, "service", { name: "Current service" });
    await archiveCatalogItem(actor, "service", old.id, testDb());

    const active = await listCatalogItems(actor, "service", {}, testDb());
    const archived = await listCatalogItems(actor, "service", { status: "archived" }, testDb());

    expect(active.items.map((i) => i.name)).toEqual(["Current service"]);
    expect(active.archivedCount).toBe(1);
    expect(archived.items.map((i) => i.name)).toEqual(["Old service"]);
  });
});

describe("getCatalogItem / updateCatalogItem", () => {
  it("updates an item and audits the changed fields", async () => {
    const actor = await actorFor();
    const service = await add(actor, "service", { name: "Aircon cleaning", unitPrice: "1,500" });

    const result = await updateCatalogItem(
      actor,
      "service",
      service.id,
      item({ name: "Aircon cleaning", unitPrice: "1,800" }),
      OPTIONS,
      testDb(),
    );

    expect(result).toMatchObject({ ok: true, item: { unitPriceMinor: 180_000 } });
    expect((await listAllAuditEvents(testDb())).at(-1)).toMatchObject({
      action: "service.updated",
      entityId: service.id,
      metadata: { changed: ["unitPriceMinor"] },
    });
  });

  it("keeps an archived default tax rate the item already had", async () => {
    const actor = await actorFor();
    const rate = await vat(actor);
    const product = await add(actor, "product", { name: "Kit", taxRateId: rate.id });
    await archiveTaxRate({ ...actor, role: "owner" }, rate.id, testDb());

    const result = await updateCatalogItem(
      actor,
      "product",
      product.id,
      item({ name: "Kit (renamed)", taxRateId: rate.id }),
      OPTIONS,
      testDb(),
    );

    expect(result).toMatchObject({ ok: true, item: { name: "Kit (renamed)", taxRateId: rate.id } });
  });

  it("treats another business's item, the wrong kind, or a bad id as not found", async () => {
    const owner = await actorFor("owner", "One");
    const product = await add(owner, "product", { name: "Kit" });
    const intruder = await actorFor("owner", "Two");

    expect(await getCatalogItem(owner, "product", product.id, testDb())).toMatchObject({ name: "Kit" });
    expect(await getCatalogItem(intruder, "product", product.id, testDb())).toBeNull();
    expect(await getCatalogItem(owner, "service", product.id, testDb())).toBeNull();
    expect(await getCatalogItem(owner, "product", "nope", testDb())).toBeNull();
    expect(
      await updateCatalogItem(intruder, "product", product.id, item({ name: "Hacked" }), OPTIONS, testDb()),
    ).toEqual({ ok: false, notFound: true });
    expect(await archiveCatalogItem(intruder, "product", product.id, testDb())).toEqual({ ok: false, notFound: true });
  });
});

describe("archiveCatalogItem / restoreCatalogItem", () => {
  it("archives and restores, auditing both", async () => {
    const actor = await actorFor();
    const product = await add(actor, "product", { name: "Kit" });

    expect(await archiveCatalogItem(actor, "product", product.id, testDb())).toEqual({ ok: true });
    expect(await restoreCatalogItem(actor, "product", product.id, testDb())).toEqual({ ok: true });

    expect((await listAllAuditEvents(testDb())).map((e) => e.action)).toEqual([
      "product.created",
      "product.archived",
      "product.restored",
    ]);
  });
});

describe("searchLineSources", () => {
  it("finds active products and services together for the line-item picker", async () => {
    const actor = await actorFor();
    await add(actor, "product", { name: "Aircon filter", sku: "FLT-9", unitLabel: "pc" });
    await add(actor, "service", { name: "Aircon cleaning", unitLabel: "unit" });
    const archived = await add(actor, "service", { name: "Aircon repair (old)" });
    await archiveCatalogItem(actor, "service", archived.id, testDb());
    await add(await actorFor("owner", "Other"), "service", { name: "Aircon install" });

    const sources = await searchLineSources(actor, "aircon", testDb());

    expect(sources.products.map((s) => [s.kind, s.name, s.sku])).toEqual([["product", "Aircon filter", "FLT-9"]]);
    expect(sources.services.map((s) => [s.kind, s.name, s.unitLabel])).toEqual([["service", "Aircon cleaning", "unit"]]);
  });
});
