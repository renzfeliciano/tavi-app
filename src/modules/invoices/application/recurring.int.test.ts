import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  closeTestDb,
  listAllAuditEvents,
  resetTables,
  testDb,
} from "@/db/testing";
import { archiveCustomer } from "@/modules/customers";
import { recurringScheduleLines, recurringSchedules } from "../schema";
import { invoices } from "../schema";
import {
  draftBill,
  FIXTURE_TODAY,
  issuedBill,
  recurringScene,
} from "./recurring-fixtures";
import {
  createSchedule,
  endSchedule,
  getSchedule,
  listSchedules,
  pauseSchedule,
  resumeSchedule,
  runDueSchedules,
  updateSchedule,
} from "./recurring";

// Made-up data only. Runs on the test database (docs/superpowers/specs/2026-10-15-recurring-invoices-design.md, sections 2 and 5).

const db = () => testDb();
const today = { today: FIXTURE_TODAY };
const monthlyFrom = (startOn: string, anchorDay = "15") => ({
  frequency: "monthly",
  anchorDay,
  startOn,
});

beforeEach(() => resetTables());
afterAll(() => closeTestDb());

async function made(overrides: Record<string, unknown> = {}) {
  const scene = await recurringScene();
  const billId = await issuedBill(scene.actor, scene.customerId);
  const result = await createSchedule(
    scene.actor,
    billId,
    { ...monthlyFrom("2026-11-01"), ...overrides },
    today,
    db(),
  );
  if (!result.ok) throw new Error(`schedule: ${JSON.stringify(result)}`);
  return { ...scene, billId, id: result.id };
}

describe("createSchedule", () => {
  it("copies the bill's customer, currency, terms and lines and picks the first due date", async () => {
    const { actor, id, billId, customerId } = await made();
    const schedule = await getSchedule(actor, id, db());
    expect(schedule).toMatchObject({
      customerId,
      sourceInvoiceId: billId,
      frequency: "monthly",
      anchorDay: 15,
      nextRunOn: "2026-11-15",
      status: "active",
      draftsCreated: 0,
      currency: "PHP",
      termsDays: 15,
      notes: "Thank you.",
    });
    expect(
      schedule?.lines.map((l) => [
        l.description,
        l.quantity,
        l.unitLabel,
        l.unitPriceMinor,
      ]),
    ).toEqual([
      ["Aircon cleaning", 20_000, "unit", 150_000],
      ["Monthly checkup", 10_000, "visit", 80_000],
    ]);
    expect(schedule?.totalMinor).toBe(2 * 150_000 + 80_000);
  });

  it("refuses a bill that is still a draft, void or cancelled", async () => {
    const scene = await recurringScene();
    const draft = await draftBill(scene.actor, scene.customerId);
    expect(
      await createSchedule(
        scene.actor,
        draft.id,
        monthlyFrom("2026-11-01"),
        today,
        db(),
      ),
    ).toEqual({
      ok: false,
      notRepeatable: true,
      status: "DRAFT",
    });
    const billId = await issuedBill(scene.actor, scene.customerId);
    for (const status of ["VOID", "CANCELLED"] as const) {
      await db()
        .update(invoices)
        .set({ status })
        .where(eq(invoices.id, billId));
      expect(
        await createSchedule(
          scene.actor,
          billId,
          monthlyFrom("2026-11-01"),
          today,
          db(),
        ),
      ).toEqual({ ok: false, notRepeatable: true, status });
    }
  });

  it("says when the bill does not exist or belongs to another business", async () => {
    const scene = await recurringScene();
    const other = await recurringScene();
    const billId = await issuedBill(other.actor, other.customerId);
    expect(
      await createSchedule(
        scene.actor,
        billId,
        monthlyFrom("2026-11-01"),
        today,
        db(),
      ),
    ).toEqual({ ok: false, notFound: true });
    expect(
      await createSchedule(
        scene.actor,
        "not-an-id",
        monthlyFrom("2026-11-01"),
        today,
        db(),
      ),
    ).toEqual({ ok: false, notFound: true });
  });

  it("refuses a start date before today and a bad day, naming the field", async () => {
    const scene = await recurringScene();
    const billId = await issuedBill(scene.actor, scene.customerId);
    expect(
      await createSchedule(
        scene.actor,
        billId,
        monthlyFrom("2026-10-13"),
        today,
        db(),
      ),
    ).toEqual({
      ok: false,
      errors: { startOn: "Choose a start date from today on." },
    });
    expect(
      await createSchedule(
        scene.actor,
        billId,
        monthlyFrom("2026-11-01", "40"),
        today,
        db(),
      ),
    ).toMatchObject({
      ok: false,
      errors: { anchorDay: expect.any(String) },
    });
    expect(await db().select().from(recurringSchedules)).toHaveLength(0);
  });

  it("accepts today as the start date", async () => {
    const { actor, id } = await made({
      startOn: FIXTURE_TODAY,
      anchorDay: "14",
    });
    expect((await getSchedule(actor, id, db()))?.nextRunOn).toBe(FIXTURE_TODAY);
  });

  it("writes its audit event in the same transaction", async () => {
    const { actor, id } = await made();
    const events = (await listAllAuditEvents(db())).filter(
      (e) => e.action === "recurring.created",
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      entityType: "recurring_schedule",
      entityId: id,
      organizationId: actor.organizationId,
    });
  });
});

describe("tenant isolation", () => {
  it("hides one business's schedules from another", async () => {
    const { id } = await made();
    const other = await recurringScene();
    expect(await getSchedule(other.actor, id, db())).toBeNull();
    expect(await pauseSchedule(other.actor, id, db())).toEqual({
      ok: false,
      notFound: true,
    });
    expect((await listSchedules(other.actor, {}, db())).total).toBe(0);
  });
});

describe("pause, resume and end", () => {
  it("pauses and resumes with the next due date after today and no backfill", async () => {
    const { actor, id } = await made({
      startOn: "2026-10-15",
      anchorDay: "15",
    });
    expect(await pauseSchedule(actor, id, db())).toEqual({ ok: true });
    expect((await getSchedule(actor, id, db()))?.status).toBe("paused");

    // The due date passed while it was paused: resuming skips it.
    expect(
      await resumeSchedule(actor, id, { today: "2026-12-20" }, db()),
    ).toEqual({ ok: true });
    const resumed = await getSchedule(actor, id, db());
    expect(resumed).toMatchObject({
      status: "active",
      nextRunOn: "2027-01-15",
      pauseReason: null,
    });
  });

  it("keeps a due date still ahead when resuming", async () => {
    const { actor, id } = await made();
    await pauseSchedule(actor, id, db());
    await resumeSchedule(actor, id, today, db());
    expect((await getSchedule(actor, id, db()))?.nextRunOn).toBe("2026-11-15");
  });

  it("keeps a quarterly schedule's months when resuming", async () => {
    const { actor, id } = await made({
      frequency: "quarterly",
      anchorDay: "15",
      startOn: "2026-11-01",
    });
    await pauseSchedule(actor, id, db());
    await resumeSchedule(actor, id, { today: "2027-06-01" }, db());
    expect((await getSchedule(actor, id, db()))?.nextRunOn).toBe("2027-08-15");
  });

  it("refuses to pause what is paused and to resume what is active", async () => {
    const { actor, id } = await made();
    expect(await resumeSchedule(actor, id, today, db())).toEqual({
      ok: false,
      wrongState: "active",
    });
    await pauseSchedule(actor, id, db());
    expect(await pauseSchedule(actor, id, db())).toEqual({
      ok: false,
      wrongState: "paused",
    });
  });

  it("ends a schedule for good", async () => {
    const { actor, id } = await made();
    expect(await endSchedule(actor, id, db())).toEqual({ ok: true });
    expect((await getSchedule(actor, id, db()))?.status).toBe("ended");
    expect(await pauseSchedule(actor, id, db())).toEqual({
      ok: false,
      wrongState: "ended",
    });
    expect(await resumeSchedule(actor, id, today, db())).toEqual({
      ok: false,
      wrongState: "ended",
    });
    expect(await endSchedule(actor, id, db())).toEqual({
      ok: false,
      wrongState: "ended",
    });
  });

  it("writes an audit event for each", async () => {
    const { actor, id } = await made();
    await pauseSchedule(actor, id, db());
    await resumeSchedule(actor, id, today, db());
    await endSchedule(actor, id, db());
    const actions = (await listAllAuditEvents(db()))
      .map((e) => e.action)
      .filter((a) => a.startsWith("recurring."));
    expect(actions).toEqual([
      "recurring.created",
      "recurring.paused",
      "recurring.resumed",
      "recurring.ended",
    ]);
  });

  it("clears the reason Tavi gave when a person resumes it", async () => {
    const { actor, id } = await made();
    await db()
      .update(recurringSchedules)
      .set({ status: "paused", pauseReason: "The customer is gone." })
      .where(eq(recurringSchedules.id, id));
    await resumeSchedule(actor, id, today, db());
    expect((await getSchedule(actor, id, db()))?.pauseReason).toBeNull();
  });
});

describe("updateSchedule", () => {
  it("changes when it repeats, how long and the notes for future drafts only", async () => {
    const { actor, id, billId } = await made();
    const result = await updateSchedule(
      actor,
      id,
      {
        frequency: "weekly",
        anchorDay: "1",
        startOn: "2026-10-20",
        endsOn: "2027-01-01",
        maxDrafts: "6",
        notes: "Updated note",
        termsDays: "30",
      },
      today,
      db(),
    );
    expect(result).toEqual({ ok: true });
    expect(await getSchedule(actor, id, db())).toMatchObject({
      frequency: "weekly",
      anchorDay: 1,
      nextRunOn: "2026-10-26",
      endsOn: "2027-01-01",
      maxDrafts: 6,
      notes: "Updated note",
      termsDays: 30,
    });
    const [source] = await db()
      .select()
      .from(invoices)
      .where(eq(invoices.id, billId));
    expect(source?.notes).toBe("Thank you.");
  });

  it("returns field errors and changes nothing", async () => {
    const { actor, id } = await made();
    const result = await updateSchedule(
      actor,
      id,
      { ...monthlyFrom("2026-10-01"), termsDays: "-1" },
      today,
      db(),
    );
    expect(result).toMatchObject({
      ok: false,
      errors: { startOn: expect.any(String), termsDays: expect.any(String) },
    });
    expect((await getSchedule(actor, id, db()))?.nextRunOn).toBe("2026-11-15");
  });

  it("refuses an ended schedule", async () => {
    const { actor, id } = await made();
    await endSchedule(actor, id, db());
    expect(
      await updateSchedule(actor, id, monthlyFrom("2026-11-01"), today, db()),
    ).toEqual({ ok: false, wrongState: "ended" });
  });

  it("refuses a number of statements that is not above the ones already made", async () => {
    const { actor, id, orgId } = await made();
    await runDueSchedules(orgId, "2026-11-15", db());
    await runDueSchedules(orgId, "2026-12-15", db());
    const result = await updateSchedule(actor, id, { ...monthlyFrom("2027-01-01", "1"), maxDrafts: "2" }, today, db());
    expect(result).toMatchObject({ ok: false, errors: { maxDrafts: expect.stringContaining("2") } });
    const ok = await updateSchedule(actor, id, { ...monthlyFrom("2027-01-01", "1"), maxDrafts: "3" }, today, db());
    expect(ok).toEqual({ ok: true });
  });

  it("does not touch the source bill's lines when the schedule's change", async () => {
    const { actor, id, billId } = await made();
    await updateSchedule(
      actor,
      id,
      { ...monthlyFrom("2026-11-01"), notes: "x" },
      today,
      db(),
    );
    expect(
      await db()
        .select()
        .from(recurringScheduleLines)
        .where(eq(recurringScheduleLines.scheduleId, id)),
    ).toHaveLength(2);
    const [source] = await db()
      .select()
      .from(invoices)
      .where(eq(invoices.id, billId));
    expect(source?.status).not.toBe("DRAFT");
  });
});

describe("listSchedules", () => {
  it("lists a business's schedules with customer name, total and a real count", async () => {
    const { actor, id, billId } = await made();
    const other = await createSchedule(
      actor,
      billId,
      { frequency: "weekly", anchorDay: "1", startOn: "2026-11-02" },
      today,
      db(),
    );
    if (!other.ok) throw new Error("second schedule");
    await pauseSchedule(actor, other.id, db());

    const all = await listSchedules(actor, {}, db());
    expect(all.total).toBe(2);
    expect(all.matching).toBe(2);
    expect(all.schedules.find((s) => s.id === id)).toMatchObject({
      customerName: "Juan Dela Cruz",
      totalMinor: 380_000,
      status: "active",
      draftsCreated: 0,
    });

    const paused = await listSchedules(actor, { status: "paused" }, db());
    expect(paused.matching).toBe(1);
    expect(paused.total).toBe(2);
    expect(paused.schedules[0]?.id).toBe(other.id);
  });

  it("finds schedules by customer name", async () => {
    const { actor } = await made();
    expect(
      (await listSchedules(actor, { search: "juan" }, db())).matching,
    ).toBe(1);
    expect(
      (await listSchedules(actor, { search: "nobody" }, db())).matching,
    ).toBe(0);
  });

  it("still lists a schedule whose customer was archived", async () => {
    const { actor, customerId } = await made();
    await archiveCustomer(actor, customerId, db());
    expect((await listSchedules(actor, {}, db())).total).toBe(1);
  });
});
