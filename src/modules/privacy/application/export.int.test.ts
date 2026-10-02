import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestOrganization, createTestUser, listAllAuditEvents, resetTables, testDb } from "@/db/testing";
import type { OrgActor, Role } from "@/modules/authz";
import { createCustomer } from "@/modules/customers";
import { exportBusinessData } from "./export";

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

async function actorFor(role: Role = "owner", name = "Acme") {
  const org = await createTestOrganization(testDb(), { name });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com`, name: "Maria Santos" });
  return { organizationId: org.id, userId: user.id, role, timezone: org.timezone } satisfies OrgActor & { timezone: string };
}

describe("exportBusinessData", () => {
  it("writes the business, the person's account and only this business's records", async () => {
    const db = testDb();
    const actor = await actorFor("owner", "Acme");
    const other = await actorFor("owner", "Other Co");
    await createCustomer(actor, { displayName: "Juan Dela Cruz" }, db);
    await createCustomer(other, { displayName: "Not mine" }, db);

    const now = new Date("2026-10-02T03:00:00Z");
    const result = await exportBusinessData(actor, db, now);
    if (!result.ok) throw new Error("export refused");

    expect(result.fileName).toBe("tavi-export-2026-10-02.json");
    const data = JSON.parse(result.body);
    expect(data).toMatchObject({
      format: "tavi-export",
      version: 1,
      exportedAt: "2026-10-02T03:00:00.000Z",
      account: { name: "Maria Santos" },
      business: { id: actor.organizationId, name: "Acme" },
      quotes: [],
      invoices: [],
      payments: [],
    });
    expect(data.customers.map((c: { displayName: string }) => c.displayName)).toEqual(["Juan Dela Cruz"]);
    expect(JSON.stringify(data)).not.toContain("Not mine");
    expect(data.account).not.toHaveProperty("password");

    const exported = (await listAllAuditEvents()).filter((e) => e.action === "organization.exported");
    expect(exported).toMatchObject([{ organizationId: actor.organizationId, actorId: actor.userId }]);
  });

  it("is for owners and admins only", async () => {
    const actor = await actorFor("member");
    await expect(exportBusinessData(actor, testDb())).rejects.toMatchObject({ name: "ForbiddenError" });
  });

  it("limits how often one person can download", async () => {
    const db = testDb();
    const actor = await actorFor();
    const now = new Date("2026-10-02T03:00:00Z");
    for (let i = 0; i < 5; i++) expect((await exportBusinessData(actor, db, now)).ok).toBe(true);
    expect(await exportBusinessData(actor, db, now)).toMatchObject({ ok: false, error: "rate_limited" });
  });
});
