import { asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, listAllAuditEvents, resetTables, testDb } from "@/db/testing";
import { archiveTaxRate, updateTaxRate } from "@/modules/catalog";
import { archiveCustomer } from "@/modules/customers";
import { blankLine } from "@/modules/documents";
import { invoiceLines, invoices, recurringSchedules } from "../schema";
import { getInvoice } from "./invoices";
import { RECURRING_PAUSE_REASONS, runDueSchedules } from "./recurring";
import { createSchedule, endSchedule, getSchedule, pauseSchedule } from "./recurring";
import { FIXTURE_TODAY, fixtureTaxRate, issuedBill, recurringScene } from "./recurring-fixtures";

// Made-up data only. Runs on the test database (docs/superpowers/specs/2026-10-15-recurring-invoices-design.md, sections 5 and 6).

const db = () => testDb();
const today = { today: FIXTURE_TODAY };

beforeEach(() => resetTables());
afterAll(() => closeTestDb());

/** A monthly schedule on the 1st, first due on 1 Nov 2026, made from an issued bill. */
async function made(overrides: Record<string, unknown> = {}, billOverrides: Record<string, unknown> = {}) {
  const scene = await recurringScene();
  const billId = await issuedBill(scene.actor, scene.customerId, billOverrides);
  const result = await createSchedule(
    scene.actor,
    billId,
    { frequency: "monthly", anchorDay: "1", startOn: "2026-11-01", ...overrides },
    today,
    db(),
  );
  if (!result.ok) throw new Error(`schedule: ${JSON.stringify(result)}`);
  return { ...scene, billId, id: result.id };
}

const draftsOf = (scheduleId: string) =>
  db().select().from(invoices).where(eq(invoices.recurringScheduleId, scheduleId)).orderBy(asc(invoices.recurringForDate));

describe("runDueSchedules", () => {
  it("makes one draft from the saved lines and terms on the due date and moves the schedule on", async () => {
    const { actor, id, orgId, customerId } = await made();
    expect(await runDueSchedules(orgId, "2026-11-01", db())).toEqual({ created: 1, paused: 0 });

    const [draft, ...others] = await draftsOf(id);
    expect(others).toHaveLength(0);
    expect(draft).toMatchObject({
      status: "DRAFT",
      number: null,
      createdBy: null,
      customerId,
      currency: "PHP",
      issueDate: "2026-11-01",
      dueDate: "2026-11-16",
      notes: "Thank you.",
      recurringForDate: "2026-11-01",
      totalMinor: 380_000,
    });
    const lines = await db().select().from(invoiceLines).where(eq(invoiceLines.invoiceId, draft?.id ?? ""));
    expect(lines.map((l) => [l.description, l.totalMinor])).toEqual([
      ["Aircon cleaning", 300_000],
      ["Monthly checkup", 80_000],
    ]);

    expect(await getSchedule(actor, id, db())).toMatchObject({ nextRunOn: "2026-12-01", draftsCreated: 1, lastRunOn: "2026-11-01", status: "active" });
    const events = (await listAllAuditEvents(db())).filter((e) => e.action === "recurring.draft_created");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actorType: "system", organizationId: orgId, entityId: id });
  });

  it("lets the draft say which schedule made it", async () => {
    const { actor, id, orgId, billId } = await made();
    await runDueSchedules(orgId, "2026-11-01", db());
    const [draft] = await draftsOf(id);
    expect((await getInvoice(actor, draft?.id ?? "", db()))?.recurringScheduleId).toBe(id);
    expect((await getInvoice(actor, billId, db()))?.recurringScheduleId).toBeNull();
  });

  it("makes nothing before the due date", async () => {
    const { id, orgId } = await made();
    expect(await runDueSchedules(orgId, "2026-10-31", db())).toEqual({ created: 0, paused: 0 });
    expect(await draftsOf(id)).toHaveLength(0);
  });

  it("makes no second draft when the job runs again the same day", async () => {
    const { id, orgId } = await made();
    await runDueSchedules(orgId, "2026-11-01", db());
    expect(await runDueSchedules(orgId, "2026-11-01", db())).toEqual({ created: 0, paused: 0 });
    expect(await draftsOf(id)).toHaveLength(1);
  });

  it("makes exactly one draft when two runs overlap, and neither fails", async () => {
    const { id, orgId } = await made();
    const [a, b] = await Promise.all([runDueSchedules(orgId, "2026-11-01", db()), runDueSchedules(orgId, "2026-11-01", db())]);
    expect(a.created + b.created).toBe(1);
    expect(await draftsOf(id)).toHaveLength(1);
  });

  it("makes one draft for the latest due date after a long gap", async () => {
    const { actor, id, orgId } = await made();
    expect(await runDueSchedules(orgId, "2027-02-10", db())).toEqual({ created: 1, paused: 0 });
    const drafts = await draftsOf(id);
    expect(drafts.map((d) => d.recurringForDate)).toEqual(["2027-02-01"]);
    expect((await getSchedule(actor, id, db()))?.nextRunOn).toBe("2027-03-01");
  });

  it("ends the schedule with the draft that uses up its number of statements", async () => {
    const { actor, id, orgId } = await made({ maxDrafts: "1" });
    await runDueSchedules(orgId, "2026-11-01", db());
    expect(await getSchedule(actor, id, db())).toMatchObject({ status: "ended", draftsCreated: 1 });
    expect(await runDueSchedules(orgId, "2026-12-01", db())).toEqual({ created: 0, paused: 0 });
    expect(await draftsOf(id)).toHaveLength(1);
  });

  it("ends the schedule when the next due date is past its end date", async () => {
    const { actor, id, orgId } = await made({ endsOn: "2026-11-20" });
    await runDueSchedules(orgId, "2026-11-01", db());
    expect((await getSchedule(actor, id, db()))?.status).toBe("ended");
  });

  it("ends without a draft when the first due date is already past the end date", async () => {
    const { actor, id, orgId } = await made({ anchorDay: "15", endsOn: "2026-11-10" });
    expect(await runDueSchedules(orgId, "2026-11-15", db())).toEqual({ created: 0, paused: 0 });
    expect(await draftsOf(id)).toHaveLength(0);
    expect((await getSchedule(actor, id, db()))?.status).toBe("ended");
  });

  it("makes nothing for a paused or an ended schedule", async () => {
    const paused = await made();
    await pauseSchedule(paused.actor, paused.id, db());
    const ended = await made();
    await endSchedule(ended.actor, ended.id, db());
    expect(await runDueSchedules(paused.orgId, "2026-11-01", db())).toEqual({ created: 0, paused: 0 });
    expect(await runDueSchedules(ended.orgId, "2026-11-01", db())).toEqual({ created: 0, paused: 0 });
    expect(await draftsOf(paused.id)).toHaveLength(0);
    expect(await draftsOf(ended.id)).toHaveLength(0);
  });

  it("pauses with a reason and makes nothing when the customer was archived", async () => {
    const { actor, id, orgId, customerId } = await made();
    await archiveCustomer(actor, customerId, db());
    expect(await runDueSchedules(orgId, "2026-11-01", db())).toEqual({ created: 0, paused: 1 });
    expect(await draftsOf(id)).toHaveLength(0);
    expect(await getSchedule(actor, id, db())).toMatchObject({ status: "paused", pauseReason: RECURRING_PAUSE_REASONS.customerGone });
  });

  it("pauses with a reason and makes nothing when a tax rate on its lines was archived", async () => {
    const scene = await recurringScene();
    const rate = await fixtureTaxRate(scene.actor);
    const billId = await issuedBill(scene.actor, scene.customerId, {
      lines: [{ ...blankLine(), description: "Aircon cleaning", quantity: "1", unitLabel: "unit", unitPrice: "1,000", taxRateId: rate.id }],
    });
    const created = await createSchedule(scene.actor, billId, { frequency: "monthly", anchorDay: "1", startOn: "2026-11-01" }, today, db());
    if (!created.ok) throw new Error("schedule");
    await archiveTaxRate(scene.actor, rate.id, db());

    expect(await runDueSchedules(scene.orgId, "2026-11-01", db())).toEqual({ created: 0, paused: 1 });
    expect(await draftsOf(created.id)).toHaveLength(0);
    expect(await getSchedule(scene.actor, created.id, db())).toMatchObject({ status: "paused", pauseReason: RECURRING_PAUSE_REASONS.taxRateGone });
  });

  it("copies each line's tax rate onto the draft", async () => {
    const scene = await recurringScene();
    const rate = await fixtureTaxRate(scene.actor);
    const billId = await issuedBill(scene.actor, scene.customerId, {
      lines: [{ ...blankLine(), description: "Aircon cleaning", quantity: "1", unitLabel: "unit", unitPrice: "1,000", taxRateId: rate.id }],
    });
    const created = await createSchedule(scene.actor, billId, { frequency: "monthly", anchorDay: "1", startOn: "2026-11-01" }, today, db());
    if (!created.ok) throw new Error("schedule");
    await runDueSchedules(scene.orgId, "2026-11-01", db());
    const [draft] = await draftsOf(created.id);
    const [line] = await db().select().from(invoiceLines).where(eq(invoiceLines.invoiceId, draft?.id ?? ""));
    expect(line).toMatchObject({ taxRateId: rate.id, taxRateName: "VAT", taxRateBps: 1200 });
  });

  it("keeps the tax rate saved in the schedule when the catalog rate is edited later", async () => {
    const scene = await recurringScene();
    const rate = await fixtureTaxRate(scene.actor);
    const billId = await issuedBill(scene.actor, scene.customerId, {
      lines: [{ ...blankLine(), description: "Aircon cleaning", quantity: "1", unitLabel: "unit", unitPrice: "1,000", taxRateId: rate.id }],
    });
    const created = await createSchedule(scene.actor, billId, { frequency: "monthly", anchorDay: "1", startOn: "2026-11-01" }, today, db());
    if (!created.ok) throw new Error("schedule");
    const edited = await updateTaxRate(scene.actor, rate.id, { name: "VAT", rate: "10" }, { locale: "en-PH" }, db());
    expect(edited.ok).toBe(true);

    await runDueSchedules(scene.orgId, "2026-11-01", db());
    const [draft] = await draftsOf(created.id);
    const [line] = await db().select().from(invoiceLines).where(eq(invoiceLines.invoiceId, draft?.id ?? ""));
    expect(line).toMatchObject({ taxRateId: rate.id, taxRateName: "VAT", taxRateBps: 1200 });
    expect(line?.taxMinor).toBe(10_714); // 12% of an inclusive 1,000.00, not 10%
    expect(draft?.totalMinor).toBe(100_000);
  });

  it("leaves another business's schedules alone", async () => {
    const mine = await made();
    const theirs = await made();
    expect(await runDueSchedules(mine.orgId, "2026-11-01", db())).toEqual({ created: 1, paused: 0 });
    expect(await draftsOf(theirs.id)).toHaveLength(0);
    expect((await db().select().from(recurringSchedules).where(eq(recurringSchedules.id, theirs.id)))[0]?.nextRunOn).toBe("2026-11-01");
  });
});
