import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { closeTestDb, createTestOrganization, resetTables, testDb } from "@/db/testing";
import { recordAuditEvent } from "@/modules/audit";
import { readFunnel, summarizeFunnel } from "./funnel";

const client = { query: async (text: string) => ({ rows: (await testDb().execute(sql.raw(text))).rows as Record<string, unknown>[] }) };

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("business_funnel view", () => {
  it("shows each business's first time at each step, from the audit log", async () => {
    const org = await createTestOrganization(testDb(), { name: "Santos Aircon" });
    await createTestOrganization(testDb(), { name: "Quiet Co" });
    const event = (action: string) =>
      recordAuditEvent(testDb(), {
        action: action as never,
        actorType: "user",
        organizationId: org.id,
        entityType: "x",
        entityId: crypto.randomUUID(),
      });
    await event("customer.created");
    await event("quote.created");
    await event("quote.sent");
    await event("quote.sent");

    const rows = await readFunnel(client);
    expect(rows.map((r) => r.businessName)).toEqual(["Santos Aircon", "Quiet Co"]);
    expect(rows[0]).toMatchObject({ firstCustomerAt: expect.any(Date), firstQuoteSentAt: expect.any(Date), firstApprovalAt: null });
    expect(rows[1]).toMatchObject({ firstCustomerAt: null, lastActiveAt: null });
    expect(summarizeFunnel(rows).steps.find((s) => s.key === "firstQuoteSentAt")?.reached).toBe(1);
  });
});
