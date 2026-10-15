import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, resetTables, testDb } from "@/db/testing";
import {
  invoices,
  recurringScheduleLines,
  recurringSchedules,
} from "../schema";
import { draftBill, recurringScene } from "./recurring-fixtures";

// Made-up data only. Runs on the test database (docs/superpowers/specs/2026-10-15-recurring-invoices-design.md, section 4).

const db = () => testDb();

beforeEach(() => resetTables());
afterAll(() => closeTestDb());

async function schedule(
  scene: Awaited<ReturnType<typeof recurringScene>>,
  overrides: Partial<typeof recurringSchedules.$inferInsert> = {},
) {
  const [row] = await db()
    .insert(recurringSchedules)
    .values({
      organizationId: scene.orgId,
      customerId: scene.customerId,
      frequency: "monthly",
      anchorDay: 15,
      nextRunOn: "2026-11-15",
      status: "active",
      currency: "PHP",
      taxMode: "exclusive",
      ...overrides,
    })
    .returning();
  if (!row) throw new Error("schedule insert");
  return row;
}

describe("recurring schedules (migration 0034)", () => {
  it("refuses two drafts for the same schedule and due date", async () => {
    const scene = await recurringScene();
    const row = await schedule(scene);
    const first = await draftBill(scene.actor, scene.customerId);
    const second = await draftBill(scene.actor, scene.customerId);
    await db()
      .update(invoices)
      .set({ recurringScheduleId: row.id, recurringForDate: "2026-11-15" })
      .where(eq(invoices.id, first.id));
    await expect(
      db()
        .update(invoices)
        .set({ recurringScheduleId: row.id, recurringForDate: "2026-11-15" })
        .where(eq(invoices.id, second.id)),
    ).rejects.toThrow();
  });

  it("allows many ordinary drafts with no schedule", async () => {
    const scene = await recurringScene();
    await draftBill(scene.actor, scene.customerId);
    await draftBill(scene.actor, scene.customerId);
    const rows = await db()
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.organizationId, scene.orgId));
    expect(rows).toHaveLength(2);
  });

  it("refuses an unknown frequency, a day of 32 and a count of 0", async () => {
    const scene = await recurringScene();
    await expect(
      schedule(scene, { frequency: "daily" as "weekly" }),
    ).rejects.toThrow();
    await expect(schedule(scene, { anchorDay: 32 })).rejects.toThrow();
    await expect(schedule(scene, { maxDrafts: 0 })).rejects.toThrow();
    await expect(
      schedule(scene, { status: "done" as "ended" }),
    ).rejects.toThrow();
  });

  it("keeps the drafts a schedule made when the schedule is deleted", async () => {
    const scene = await recurringScene();
    const row = await schedule(scene);
    const draft = await draftBill(scene.actor, scene.customerId);
    await db()
      .update(invoices)
      .set({ recurringScheduleId: row.id, recurringForDate: "2026-11-15" })
      .where(eq(invoices.id, draft.id));
    await db()
      .delete(recurringSchedules)
      .where(eq(recurringSchedules.id, row.id));
    const [kept] = await db()
      .select()
      .from(invoices)
      .where(eq(invoices.id, draft.id));
    expect(kept?.recurringScheduleId).toBeNull();
    expect(kept?.status).toBe("DRAFT");
  });

  it("removes a schedule's lines with it", async () => {
    const scene = await recurringScene();
    const row = await schedule(scene);
    await db().insert(recurringScheduleLines).values({
      organizationId: scene.orgId,
      scheduleId: row.id,
      position: 0,
      description: "Monthly checkup",
      unitLabel: "visit",
      quantity: "1.0000",
      unitPriceMinor: 80_000,
    });
    await db()
      .delete(recurringSchedules)
      .where(eq(recurringSchedules.id, row.id));
    expect(await db().select().from(recurringScheduleLines)).toHaveLength(0);
  });
});
