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
import { CUSTOMER_PAGE_SIZE } from "../domain/limits";
import {
  archiveCustomer,
  createCustomer,
  getCustomer,
  listCustomers,
  restoreCustomer,
  updateCustomer,
} from "./customers";

async function actorFor(role: Role = "member", name = "Acme"): Promise<OrgActor> {
  const org = await createTestOrganization(testDb(), { name });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com` });
  return { organizationId: org.id, userId: user.id, role };
}

async function add(actor: OrgActor, displayName: string, extra: Record<string, string> = {}) {
  const result = await createCustomer(actor, { displayName, ...extra }, testDb());
  if (!result.ok) throw new Error(`create failed: ${JSON.stringify(result)}`);
  return result.customer;
}

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("createCustomer", () => {
  it("lets any member add a customer, and audits it", async () => {
    const actor = await actorFor("member");

    const customer = await add(actor, "  Juan Dela Cruz ", { email: "Juan@Example.com", currency: "USD" });

    expect(customer).toMatchObject({
      displayName: "Juan Dela Cruz",
      email: "juan@example.com",
      currency: "USD",
      company: null,
      archivedAt: null,
    });
    expect(await listAllAuditEvents(testDb())).toEqual([
      expect.objectContaining({
        action: "customer.created",
        actorId: actor.userId,
        organizationId: actor.organizationId,
        entityType: "customer",
        entityId: customer.id,
      }),
    ]);
  });

  it("returns field errors and saves nothing for invalid input", async () => {
    const actor = await actorFor();

    const result = await createCustomer(actor, { displayName: "", email: "nope" }, testDb());

    expect(result).toEqual({
      ok: false,
      fieldErrors: { displayName: ["Enter the customer's name."], email: ["Enter a valid email address."] },
    });
    expect((await listCustomers(actor, {}, testDb())).customers).toEqual([]);
  });
});

describe("listCustomers", () => {
  it("lists the business's active customers by name, never another business's", async () => {
    const actor = await actorFor("member", "One");
    await add(actor, "maria santos");
    await add(actor, "Andres Bonifacio");
    await add(actor, "Carlos Garcia");
    await add(await actorFor("owner", "Two"), "Someone Else");

    const { customers, hasMore, archivedCount } = await listCustomers(actor, {}, testDb());

    expect(customers.map((c) => c.displayName)).toEqual(["Andres Bonifacio", "Carlos Garcia", "maria santos"]);
    expect(hasMore).toBe(false);
    expect(archivedCount).toBe(0);
  });

  it("searches name, company, email and phone, matching % and _ literally", async () => {
    const actor = await actorFor();
    await add(actor, "Juan Dela Cruz", { company: "Dela Cruz Bakery" });
    await add(actor, "Ana Reyes", { email: "ana@bakery.example" });
    await add(actor, "Pedro Penduko", { phone: "0917 555 0100" });
    await add(actor, "100% Pure Water Co");
    await add(actor, "1000 Islands Resort");

    const names = async (search: string) =>
      (await listCustomers(actor, { search }, testDb())).customers.map((c) => c.displayName);

    expect(await names("bakery")).toEqual(["Ana Reyes", "Juan Dela Cruz"]);
    expect(await names("555 0100")).toEqual(["Pedro Penduko"]);
    expect(await names("100%")).toEqual(["100% Pure Water Co"]);
    expect(await names("nobody")).toEqual([]);
  });

  it("pages through long lists", async () => {
    const actor = await actorFor();
    for (let i = 1; i <= CUSTOMER_PAGE_SIZE + 2; i++) {
      await add(actor, `Customer ${String(i).padStart(3, "0")}`);
    }

    const first = await listCustomers(actor, { page: 1 }, testDb());
    const second = await listCustomers(actor, { page: 2 }, testDb());

    expect(first.customers).toHaveLength(CUSTOMER_PAGE_SIZE);
    expect(first.hasMore).toBe(true);
    expect(second.customers.map((c) => c.displayName)).toEqual([
      `Customer ${String(CUSTOMER_PAGE_SIZE + 1).padStart(3, "0")}`,
      `Customer ${String(CUSTOMER_PAGE_SIZE + 2).padStart(3, "0")}`,
    ]);
    expect(second.hasMore).toBe(false);
  });

  it("shows archived customers separately", async () => {
    const actor = await actorFor();
    const old = await add(actor, "Old Client");
    await add(actor, "Current Client");
    await archiveCustomer(actor, old.id, testDb());

    const active = await listCustomers(actor, {}, testDb());
    const archived = await listCustomers(actor, { status: "archived" }, testDb());

    expect(active.customers.map((c) => c.displayName)).toEqual(["Current Client"]);
    expect(active.archivedCount).toBe(1);
    expect(archived.customers.map((c) => c.displayName)).toEqual(["Old Client"]);
  });
});

describe("getCustomer", () => {
  it("finds the business's own customer; another business's id or a bad id is not found", async () => {
    const owner = await actorFor("owner", "One");
    const customer = await add(owner, "Juan Dela Cruz");
    const intruder = await actorFor("owner", "Two");

    expect(await getCustomer(owner, customer.id, testDb())).toMatchObject({ displayName: "Juan Dela Cruz" });
    expect(await getCustomer(intruder, customer.id, testDb())).toBeNull();
    expect(await getCustomer(owner, "not-a-uuid", testDb())).toBeNull();
  });
});

describe("updateCustomer", () => {
  it("saves changes and audits which fields changed", async () => {
    const actor = await actorFor();
    const customer = await add(actor, "Juan Dela Cruz", { phone: "0917 000 0000" });

    const result = await updateCustomer(
      actor,
      customer.id,
      { displayName: "Juan Dela Cruz", phone: "0917 555 0100", city: "Pasig" },
      testDb(),
    );

    expect(result).toMatchObject({ ok: true, customer: { phone: "0917 555 0100", city: "Pasig" } });
    expect((await listAllAuditEvents(testDb())).at(-1)).toMatchObject({
      action: "customer.updated",
      entityId: customer.id,
      metadata: { changed: ["phone", "city"] },
    });
  });

  it("treats another business's customer as not found and leaves it unchanged", async () => {
    const owner = await actorFor("owner", "One");
    const customer = await add(owner, "Juan Dela Cruz");
    const intruder = await actorFor("owner", "Two");

    expect(await updateCustomer(intruder, customer.id, { displayName: "Hacked" }, testDb())).toEqual({
      ok: false,
      notFound: true,
    });
    expect(await getCustomer(owner, customer.id, testDb())).toMatchObject({ displayName: "Juan Dela Cruz" });
  });
});

describe("archiveCustomer / restoreCustomer", () => {
  it("archives and restores, auditing both; another business can't touch it", async () => {
    const owner = await actorFor("member", "One");
    const customer = await add(owner, "Juan Dela Cruz");
    const intruder = await actorFor("owner", "Two");

    expect(await archiveCustomer(intruder, customer.id, testDb())).toEqual({ ok: false, notFound: true });
    expect(await archiveCustomer(owner, customer.id, testDb())).toEqual({ ok: true });
    expect((await getCustomer(owner, customer.id, testDb()))?.archivedAt).toBeInstanceOf(Date);
    expect(await restoreCustomer(owner, customer.id, testDb())).toEqual({ ok: true });
    expect((await getCustomer(owner, customer.id, testDb()))?.archivedAt).toBeNull();

    expect((await listAllAuditEvents(testDb())).map((e) => e.action)).toEqual([
      "customer.created",
      "customer.archived",
      "customer.restored",
    ]);
  });
});
