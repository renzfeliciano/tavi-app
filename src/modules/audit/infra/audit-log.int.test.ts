import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeTestDb, createTestOrganization, createTestUser, resetTables, testDb } from "@/db/testing";
import { auditEvents } from "../schema";
import { listAuditEvents, recordAuditEvent } from "./audit-log";

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("recordAuditEvent", () => {
  it("writes the event with actor, tenant, entity and metadata", async () => {
    const user = await createTestUser();
    const org = await createTestOrganization();

    await recordAuditEvent(testDb(), {
      action: "organization.created",
      actorType: "user",
      actorId: user.id,
      organizationId: org.id,
      entityType: "organization",
      entityId: org.id,
      metadata: { name: org.name },
    });

    const rows = await listAuditEvents(org.id, testDb());
    expect(rows).toEqual([
      expect.objectContaining({
        action: "organization.created",
        actorType: "user",
        actorId: user.id,
        entityId: org.id,
        metadata: { name: org.name },
      }),
    ]);
  });

  it("strips secrets from metadata before storing it", async () => {
    await recordAuditEvent(testDb(), {
      action: "auth.password_reset",
      actorType: "user",
      entityType: "user",
      metadata: { token: "reset-token", via: "email" },
    });

    const [row] = await testDb().select().from(auditEvents);
    expect(row?.metadata).toEqual({ token: "[redacted]", via: "email" });
  });

  it("joins the caller's transaction, so a rollback removes the event too", async () => {
    await expect(
      testDb().transaction(async (tx) => {
        await recordAuditEvent(tx, { action: "auth.signed_in", actorType: "user", entityType: "session" });
        throw new Error("the business change failed");
      }),
    ).rejects.toThrow();

    expect(await testDb().select().from(auditEvents)).toHaveLength(0);
  });
});

describe("append-only guarantee", () => {
  it("refuses updates", async () => {
    await recordAuditEvent(testDb(), { action: "auth.signed_in", actorType: "user", entityType: "session" });
    await expect(
      testDb().update(auditEvents).set({ action: "auth.signed_out" }),
    ).rejects.toMatchObject({ cause: { code: "42501" } });
  });

  it("refuses deletes", async () => {
    await recordAuditEvent(testDb(), { action: "auth.signed_in", actorType: "user", entityType: "session" });
    await expect(testDb().delete(auditEvents).where(sql`true`)).rejects.toMatchObject({
      cause: { code: "42501" },
    });
    expect(await testDb().select().from(auditEvents).where(eq(auditEvents.action, "auth.signed_in"))).toHaveLength(1);
  });
});
