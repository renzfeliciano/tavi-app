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
import {
  archiveSupplier,
  createSupplier,
  getSupplier,
  listSuppliers,
  restoreSupplier,
  searchSuppliers,
  updateSupplier,
} from "./suppliers";

async function actorFor(role: Role = "member", name = "Acme"): Promise<OrgActor> {
  const org = await createTestOrganization(testDb(), { name });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com` });
  return { organizationId: org.id, userId: user.id, role };
}

async function add(actor: OrgActor, displayName: string, extra: Record<string, string> = {}) {
  const result = await createSupplier(actor, { displayName, ...extra }, testDb());
  if (!result.ok) throw new Error(`create failed: ${JSON.stringify(result)}`);
  return result.supplier;
}

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("createSupplier", () => {
  it("lets any member add a supplier, and audits it without copying contact details", async () => {
    const actor = await actorFor("member");

    const supplier = await add(actor, "  Santos Hardware ", { email: "Orders@Santos.example" });

    expect(supplier).toMatchObject({ displayName: "Santos Hardware", email: "orders@santos.example", archivedAt: null });
    expect(await listAllAuditEvents(testDb())).toEqual([
      expect.objectContaining({
        action: "supplier.created",
        actorId: actor.userId,
        organizationId: actor.organizationId,
        entityType: "supplier",
        entityId: supplier.id,
        metadata: {},
      }),
    ]);
  });

  it("returns field errors and saves nothing for invalid input", async () => {
    const actor = await actorFor();

    const result = await createSupplier(actor, { displayName: " ", email: "nope" }, testDb());

    expect(result).toMatchObject({ ok: false, fieldErrors: { displayName: expect.any(Array), email: expect.any(Array) } });
    expect(await listAllAuditEvents(testDb())).toEqual([]);
  });
});

describe("updateSupplier", () => {
  it("changes only what changed and audits the field names", async () => {
    const actor = await actorFor();
    const supplier = await add(actor, "Santos Hardware", { phone: "0917 555 0111" });

    const result = await updateSupplier(actor, supplier.id, { displayName: "Santos Hardware", phone: "0917 555 0222" }, testDb());

    expect(result).toMatchObject({ ok: true, supplier: { phone: "0917 555 0222" } });
    const events = await listAllAuditEvents(testDb());
    expect(events.at(-1)).toMatchObject({ action: "supplier.updated", metadata: { changed: ["phone"] } });
  });

  it("does not audit a save that changes nothing", async () => {
    const actor = await actorFor();
    const supplier = await add(actor, "Santos Hardware");

    await updateSupplier(actor, supplier.id, { displayName: "Santos Hardware" }, testDb());

    expect(await listAllAuditEvents(testDb())).toHaveLength(1);
  });

  it("cannot reach another business's supplier", async () => {
    const mine = await actorFor("member", "Mine");
    const theirs = await actorFor("member", "Theirs");
    const supplier = await add(theirs, "Their supplier");

    expect(await updateSupplier(mine, supplier.id, { displayName: "Taken" }, testDb())).toEqual({ ok: false, notFound: true });
    expect(await getSupplier(mine, supplier.id, testDb())).toBeNull();
    expect(await archiveSupplier(mine, supplier.id, testDb())).toEqual({ ok: false, notFound: true });
  });
});

describe("archive and restore", () => {
  it("hides an archived supplier from the active list and brings it back", async () => {
    const actor = await actorFor();
    const supplier = await add(actor, "Santos Hardware");

    expect(await archiveSupplier(actor, supplier.id, testDb())).toEqual({ ok: true });
    expect((await listSuppliers(actor, {}, testDb())).suppliers).toEqual([]);
    expect((await listSuppliers(actor, { status: "archived" }, testDb())).suppliers).toHaveLength(1);

    expect(await restoreSupplier(actor, supplier.id, testDb())).toEqual({ ok: true });
    expect((await listSuppliers(actor, {}, testDb())).suppliers).toHaveLength(1);
    const actions = (await listAllAuditEvents(testDb())).map((e) => e.action);
    expect(actions).toEqual(["supplier.created", "supplier.archived", "supplier.restored"]);
  });
});

describe("listSuppliers and searchSuppliers", () => {
  it("lists by name, searches name, contact and email, and counts archived", async () => {
    const actor = await actorFor();
    await add(actor, "Zeta Paper");
    await add(actor, "alpha Steel", { contactName: "Rosa Reyes" });
    const old = await add(actor, "Old Trader");
    await archiveSupplier(actor, old.id, testDb());

    const all = await listSuppliers(actor, {}, testDb());
    expect(all.suppliers.map((s) => s.displayName)).toEqual(["alpha Steel", "Zeta Paper"]);
    expect(all.archivedCount).toBe(1);
    expect((await listSuppliers(actor, { search: "reyes" }, testDb())).suppliers.map((s) => s.displayName)).toEqual(["alpha Steel"]);
  });

  it("treats % in a search as text, and finds only active suppliers of this business", async () => {
    const actor = await actorFor("member", "Mine");
    const other = await actorFor("member", "Theirs");
    await add(actor, "100% Cotton Co");
    await add(actor, "Plain Co");
    await add(other, "Plain Other");

    expect((await searchSuppliers(actor, "%", testDb())).map((s) => s.displayName)).toEqual(["100% Cotton Co"]);
    expect((await searchSuppliers(actor, "plain", testDb())).map((s) => s.displayName)).toEqual(["Plain Co"]);
  });
});
