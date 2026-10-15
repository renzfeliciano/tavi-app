import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { type Database, type Executor, getDb } from "@/db";
import { type AuditAction, recordAuditEvent } from "@/modules/audit";
import { assertCan, type OrgActor } from "@/modules/authz";
import { activeTaxRates } from "@/modules/catalog";
import { customerIsActive, findCustomerIds, getCustomerNames } from "@/modules/customers";
import {
  DOCUMENT_LIMITS,
  type LineInput,
  numericToQuantity,
  type ParsedLine,
  quantityToNumeric,
  type TaxMode,
} from "@/modules/documents";
import { BUSINESS_PROFILE_LIMITS } from "@/modules/organizations";
import { addDays, type CalendarDate, compareDates, daysBetween } from "@/shared/dates/calendar";
import { logger } from "@/shared/logger";
import {
  type PageMeta,
  pageMeta,
  pageWindow,
} from "@/shared/pagination/page-window";
import { tooLong } from "@/shared/validation/messages";
import {
  advancePast,
  firstRunOn,
  isFinished,
  parseRecurrence,
  type Recurrence,
  type RecurrenceFrequency,
} from "../domain/recurrence";
import type { InvoiceStatus } from "../domain/status";
import {
  invoiceLines,
  invoices,
  recurringScheduleLines,
  recurringSchedules,
  type SCHEDULE_STATUSES,
} from "../schema";
import { calculate, headerAmounts, lineRows, loadHeader, loadLines } from "./invoices";

// Recurring billing statements (spec 2, 5): a schedule made from an issued bill. The daily job (runDueSchedules)
// makes one draft per due date from the schedule's own copy of the lines; nothing is sent or numbered until a person issues it.

export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

/** Bills that can be repeated: issued, and still standing. */
const NOT_REPEATABLE: readonly InvoiceStatus[] = ["DRAFT", "VOID", "CANCELLED"];

export type ScheduleLine = {
  position: number;
  description: string;
  unitLabel: string;
  /** Scaled ×10 000. */
  quantity: number;
  unitPriceMinor: number;
  discountKind: "percent" | "amount" | null;
  discountValue: number | null;
  taxRateId: string | null;
  /** The rate as it was when the schedule was made. */
  taxRateName: string | null;
  taxRateBps: number | null;
  sourceKind: "product" | "service" | null;
  sourceId: string | null;
};

export type ScheduleHeader = {
  id: string;
  customerId: string;
  sourceInvoiceId: string | null;
  frequency: RecurrenceFrequency;
  anchorDay: number;
  anchorMonth: number | null;
  nextRunOn: CalendarDate;
  endsOn: CalendarDate | null;
  maxDrafts: number | null;
  draftsCreated: number;
  status: ScheduleStatus;
  pauseReason: string | null;
  termsDays: number;
  currency: string;
  taxMode: TaxMode;
  notes: string | null;
  terms: string | null;
  lastRunOn: CalendarDate | null;
  createdAt: Date;
};

export type ScheduleDraft = {
  id: string;
  number: string | null;
  status: InvoiceStatus;
  forDate: CalendarDate;
};

export type ScheduleDetail = ScheduleHeader & {
  lines: ScheduleLine[];
  /** What each draft will total, worked out from the lines and the tax rates as they are now. */
  totalMinor: number;
  drafts: ScheduleDraft[];
};

export type ScheduleSummary = Pick<
  ScheduleHeader,
  | "id"
  | "customerId"
  | "frequency"
  | "anchorDay"
  | "anchorMonth"
  | "nextRunOn"
  | "draftsCreated"
  | "status"
  | "currency"
> & { customerName: string | null; totalMinor: number };

export type ScheduleList = PageMeta & {
  schedules: ScheduleSummary[];
  total: number;
};

export type CreateScheduleResult =
  | { ok: true; id: string }
  | { ok: false; notFound: true }
  | { ok: false; notRepeatable: true; status: InvoiceStatus }
  | { ok: false; errors: Record<string, string> };

export type UpdateScheduleResult =
  | { ok: true }
  | { ok: false; notFound: true }
  | { ok: false; wrongState: ScheduleStatus }
  | { ok: false; errors: Record<string, string> };

export type ScheduleCommandResult =
  | { ok: true }
  | { ok: false; notFound: true }
  | { ok: false; wrongState: ScheduleStatus };

const scheduleColumns = {
  id: recurringSchedules.id,
  customerId: recurringSchedules.customerId,
  sourceInvoiceId: recurringSchedules.sourceInvoiceId,
  frequency: recurringSchedules.frequency,
  anchorDay: recurringSchedules.anchorDay,
  anchorMonth: recurringSchedules.anchorMonth,
  nextRunOn: recurringSchedules.nextRunOn,
  endsOn: recurringSchedules.endsOn,
  maxDrafts: recurringSchedules.maxDrafts,
  draftsCreated: recurringSchedules.draftsCreated,
  status: recurringSchedules.status,
  pauseReason: recurringSchedules.pauseReason,
  termsDays: recurringSchedules.termsDays,
  currency: recurringSchedules.currency,
  taxMode: recurringSchedules.taxMode,
  notes: recurringSchedules.notes,
  terms: recurringSchedules.terms,
  lastRunOn: recurringSchedules.lastRunOn,
  createdAt: recurringSchedules.createdAt,
};

const isUuid = (id: string) => z.uuid().safeParse(id).success;
const ofOrganization = (actor: Pick<OrgActor, "organizationId">) =>
  eq(recurringSchedules.organizationId, actor.organizationId);

export function auditSchedule(
  tx: Executor,
  actor: Pick<OrgActor, "organizationId" | "userId">,
  action: AuditAction,
  scheduleId: string,
  metadata?: Record<string, unknown>,
) {
  return recordAuditEvent(tx, {
    action,
    actorType: "user",
    actorId: actor.userId,
    organizationId: actor.organizationId,
    entityType: "recurring_schedule",
    entityId: scheduleId,
    metadata,
  });
}

/** A schedule line as the draft writer takes it. */
export function toParsedLine(line: ScheduleLine): ParsedLine {
  return {
    description: line.description,
    quantity: line.quantity,
    unitLabel: line.unitLabel,
    unitPriceMinor: line.unitPriceMinor,
    discount:
      line.discountKind === "percent"
        ? { kind: "percent", bps: line.discountValue ?? 0 }
        : line.discountKind === "amount"
          ? { kind: "amount", amountMinor: line.discountValue ?? 0 }
          : null,
    taxRateId: line.taxRateId,
    source:
      line.sourceKind && line.sourceId
        ? { kind: line.sourceKind, id: line.sourceId }
        : null,
  };
}

export async function loadScheduleLines(
  tx: Executor,
  scheduleId: string,
): Promise<ScheduleLine[]> {
  const rows = await tx
    .select({
      position: recurringScheduleLines.position,
      description: recurringScheduleLines.description,
      unitLabel: recurringScheduleLines.unitLabel,
      quantity: recurringScheduleLines.quantity,
      unitPriceMinor: recurringScheduleLines.unitPriceMinor,
      discountKind: recurringScheduleLines.discountKind,
      discountValue: recurringScheduleLines.discountValue,
      taxRateId: recurringScheduleLines.taxRateId,
      taxRateName: recurringScheduleLines.taxRateName,
      taxRateBps: recurringScheduleLines.taxRateBps,
      sourceKind: recurringScheduleLines.sourceKind,
      sourceId: recurringScheduleLines.sourceId,
    })
    .from(recurringScheduleLines)
    .where(eq(recurringScheduleLines.scheduleId, scheduleId))
    .orderBy(asc(recurringScheduleLines.position));
  return rows.map((row) => ({
    ...row,
    quantity: numericToQuantity(row.quantity),
  }));
}

/** The tax a line carries: the rate saved in the schedule, whatever the catalog says now. */
const savedTax = (line: ScheduleLine) =>
  line.taxRateId !== null && line.taxRateName !== null && line.taxRateBps !== null
    ? { id: line.taxRateId, name: line.taxRateName, rateBps: line.taxRateBps }
    : null;

/** What a draft from these lines totals, with each tax rate as saved in the schedule. */
function totalOf(taxMode: TaxMode, lines: readonly ScheduleLine[]): number {
  const inputs: LineInput[] = lines.map((line) => {
    const parsed = toParsedLine(line);
    const tax = savedTax(line);
    return {
      unitPriceMinor: parsed.unitPriceMinor,
      quantity: parsed.quantity,
      discount: parsed.discount,
      tax: tax ? { name: tax.name, rateBps: tax.rateBps } : null,
    };
  });
  const calculated = calculate(taxMode, inputs);
  return calculated.ok ? calculated.amounts.totalMinor : 0;
}

const recurrenceOf = (
  row: Pick<ScheduleHeader, "frequency" | "anchorDay" | "anchorMonth">,
): Recurrence => ({
  frequency: row.frequency,
  anchorDay: row.anchorDay,
  anchorMonth: row.anchorMonth,
});

/** Notes, terms and payment terms for future drafts, as the edit form sends them. Absent fields stay as they are. */
function parseDetails(
  input: unknown,
):
  | {
      ok: true;
      values: {
        notes?: string | null;
        terms?: string | null;
        termsDays?: number;
      };
    }
  | { ok: false; errors: Record<string, string> } {
  const source =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const errors: Record<string, string> = {};
  const values: {
    notes?: string | null;
    terms?: string | null;
    termsDays?: number;
  } = {};
  for (const field of ["notes", "terms"] as const) {
    const value = source[field];
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (text.length > DOCUMENT_LIMITS[field])
      errors[field] = tooLong(DOCUMENT_LIMITS[field]);
    else values[field] = text === "" ? null : text;
  }
  const raw = source.termsDays;
  if (raw !== undefined && raw !== "") {
    const { min, max } = BUSINESS_PROFILE_LIMITS.paymentTermsDays;
    const text =
      typeof raw === "number"
        ? String(raw)
        : typeof raw === "string"
          ? raw.trim()
          : "";
    const days = /^-?\d{1,9}$/.test(text) ? Number(text) : Number.NaN;
    if (days >= min && days <= max) values.termsDays = days;
    else errors.termsDays = `Choose between ${min} and ${max} days.`;
  }
  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, values };
}

/** Makes a schedule from an issued bill: its customer, lines and terms are copied, and the first due date is picked. */
export async function createSchedule(
  actor: OrgActor,
  sourceInvoiceId: string,
  input: unknown,
  { today }: { today: CalendarDate },
  db: Database = getDb(),
): Promise<CreateScheduleResult> {
  assertCan(actor, "invoices.write");
  const source = await loadHeader(db, actor, sourceInvoiceId);
  if (!source || source.customerId === null)
    return { ok: false, notFound: true };
  if (NOT_REPEATABLE.includes(source.status))
    return { ok: false, notRepeatable: true, status: source.status };

  const parsed = parseRecurrence(input, { today });
  const details = parseDetails(input);
  if (!parsed.ok || !details.ok) {
    return {
      ok: false,
      errors: {
        ...(parsed.ok ? {} : parsed.errors),
        ...(details.ok ? {} : details.errors),
      },
    };
  }
  const lines = await loadLines(db, source.id);
  const nextRunOn = firstRunOn(parsed.rule, parsed.startOn);

  return db.transaction(async (tx): Promise<CreateScheduleResult> => {
    const [schedule] = await tx
      .insert(recurringSchedules)
      .values({
        organizationId: actor.organizationId,
        customerId: source.customerId as string,
        sourceInvoiceId: source.id,
        frequency: parsed.rule.frequency,
        anchorDay: parsed.rule.anchorDay,
        anchorMonth: parsed.rule.anchorMonth,
        nextRunOn,
        endsOn: parsed.endsOn,
        maxDrafts: parsed.maxDrafts,
        termsDays:
          details.values.termsDays ??
          Math.max(0, daysBetween(source.issueDate, source.dueDate)),
        currency: source.currency,
        taxMode: source.taxMode,
        notes:
          details.values.notes !== undefined
            ? details.values.notes
            : source.notes,
        terms:
          details.values.terms !== undefined
            ? details.values.terms
            : source.terms,
        createdBy: actor.userId,
      })
      .returning({ id: recurringSchedules.id });
    if (!schedule) throw new Error("Schedule insert returned no row");
    if (lines.length > 0) {
      await tx.insert(recurringScheduleLines).values(
        lines.map((line) => ({
          organizationId: actor.organizationId,
          scheduleId: schedule.id,
          position: line.position,
          sourceKind: line.sourceKind,
          sourceId: line.sourceId,
          description: line.description,
          unitLabel: line.unitLabel,
          quantity: quantityToNumeric(line.quantity),
          unitPriceMinor: line.unitPriceMinor,
          discountKind: line.discountKind,
          discountValue: line.discountValue,
          taxRateId: line.taxRateId,
          taxRateName: line.taxRateName,
          taxRateBps: line.taxRateBps,
        })),
      );
    }
    await auditSchedule(tx, actor, "recurring.created", schedule.id, {
      frequency: parsed.rule.frequency,
      nextRunOn,
      sourceInvoiceId: source.id,
    });
    return { ok: true, id: schedule.id };
  });
}

async function loadSchedule(
  tx: Executor,
  actor: Pick<OrgActor, "organizationId">,
  id: string,
  lock = false,
) {
  if (!isUuid(id)) return undefined;
  const query = tx
    .select(scheduleColumns)
    .from(recurringSchedules)
    .where(and(eq(recurringSchedules.id, id), ofOrganization(actor)));
  const [row] = await (lock ? query.for("update") : query);
  return row;
}

/** Changes when it repeats, for how long, and the notes and terms of future drafts. Lines stay as they were made. */
export async function updateSchedule(
  actor: OrgActor,
  id: string,
  input: unknown,
  { today }: { today: CalendarDate },
  db: Database = getDb(),
): Promise<UpdateScheduleResult> {
  assertCan(actor, "invoices.write");
  const parsed = parseRecurrence(input, { today });
  const details = parseDetails(input);
  const errors = {
    ...(parsed.ok ? {} : parsed.errors),
    ...(details.ok ? {} : details.errors),
  };

  return db.transaction(async (tx): Promise<UpdateScheduleResult> => {
    const current = await loadSchedule(tx, actor, id, true);
    if (!current) return { ok: false, notFound: true };
    if (current.status === "ended") return { ok: false, wrongState: "ended" };
    if (!parsed.ok || !details.ok) return { ok: false, errors };
    if (parsed.maxDrafts !== null && parsed.maxDrafts <= current.draftsCreated) {
      return {
        ok: false,
        errors: { maxDrafts: `${current.draftsCreated} already made. Enter a higher number, or leave it empty.` },
      };
    }
    const nextRunOn = firstRunOn(parsed.rule, parsed.startOn);
    await tx
      .update(recurringSchedules)
      .set({
        frequency: parsed.rule.frequency,
        anchorDay: parsed.rule.anchorDay,
        anchorMonth: parsed.rule.anchorMonth,
        nextRunOn,
        endsOn: parsed.endsOn,
        maxDrafts: parsed.maxDrafts,
        ...details.values,
      })
      .where(eq(recurringSchedules.id, current.id));
    await auditSchedule(tx, actor, "recurring.updated", current.id, {
      frequency: parsed.rule.frequency,
      nextRunOn,
    });
    return { ok: true };
  });
}

async function transition(
  actor: OrgActor,
  id: string,
  from: readonly ScheduleStatus[],
  change: (current: NonNullable<Awaited<ReturnType<typeof loadSchedule>>>) => {
    set: Partial<typeof recurringSchedules.$inferInsert>;
    action: AuditAction;
  },
  db: Database,
): Promise<ScheduleCommandResult> {
  return db.transaction(async (tx): Promise<ScheduleCommandResult> => {
    const current = await loadSchedule(tx, actor, id, true);
    if (!current) return { ok: false, notFound: true };
    if (!from.includes(current.status))
      return { ok: false, wrongState: current.status };
    const { set, action } = change(current);
    await tx
      .update(recurringSchedules)
      .set(set)
      .where(eq(recurringSchedules.id, current.id));
    await auditSchedule(tx, actor, action, current.id);
    return { ok: true };
  });
}

export async function pauseSchedule(
  actor: OrgActor,
  id: string,
  db: Database = getDb(),
): Promise<ScheduleCommandResult> {
  assertCan(actor, "invoices.write");
  return transition(
    actor,
    id,
    ["active"],
    () => ({
      set: { status: "paused", pauseReason: null },
      action: "recurring.paused",
    }),
    db,
  );
}

/** Continues from the next due date after today: nothing missed while it was paused is made up. */
export async function resumeSchedule(
  actor: OrgActor,
  id: string,
  { today }: { today: CalendarDate },
  db: Database = getDb(),
): Promise<ScheduleCommandResult> {
  assertCan(actor, "invoices.write");
  return transition(
    actor,
    id,
    ["paused"],
    (current) => ({
      set: {
        status: "active",
        pauseReason: null,
        nextRunOn:
          compareDates(current.nextRunOn, today) > 0
            ? current.nextRunOn
            : advancePast(recurrenceOf(current), current.nextRunOn, today).next,
      },
      action: "recurring.resumed",
    }),
    db,
  );
}

export async function endSchedule(
  actor: OrgActor,
  id: string,
  db: Database = getDb(),
): Promise<ScheduleCommandResult> {
  assertCan(actor, "invoices.write");
  return transition(
    actor,
    id,
    ["active", "paused"],
    () => ({ set: { status: "ended" }, action: "recurring.ended" }),
    db,
  );
}

export async function getSchedule(
  actor: OrgActor,
  id: string,
  db: Database = getDb(),
): Promise<ScheduleDetail | null> {
  assertCan(actor, "invoices.read");
  const header = await loadSchedule(db, actor, id);
  if (!header) return null;
  const [lines, drafts] = await Promise.all([
    loadScheduleLines(db, header.id),
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        status: invoices.status,
        forDate: sql<CalendarDate>`${invoices.recurringForDate}`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, actor.organizationId),
          eq(invoices.recurringScheduleId, header.id),
        ),
      )
      .orderBy(desc(invoices.recurringForDate)),
  ]);
  return {
    ...header,
    lines,
    totalMinor: totalOf(header.taxMode, lines),
    drafts,
  };
}

/** The business's schedules, soonest due first among the active ones, optionally by status or by customer name. */
export async function listSchedules(
  actor: OrgActor,
  {
    search = null,
    status,
    page = 1,
    pageSize,
  }: {
    search?: string | null;
    status?: ScheduleStatus;
    page?: number;
    pageSize?: number;
  },
  db: Database = getDb(),
): Promise<ScheduleList> {
  assertCan(actor, "invoices.read");
  const customerIds = search ? await findCustomerIds(actor, search, db) : null;
  const where = and(
    ofOrganization(actor),
    status ? eq(recurringSchedules.status, status) : undefined,
    customerIds === null
      ? undefined
      : customerIds.length > 0
        ? inArray(recurringSchedules.customerId, customerIds)
        : sql`false`,
  );
  const [[matching], [total]] = await Promise.all([
    db.select({ value: count() }).from(recurringSchedules).where(where),
    db
      .select({ value: count() })
      .from(recurringSchedules)
      .where(ofOrganization(actor)),
  ]);
  const window = pageWindow({ page, pageSize, matching: matching?.value ?? 0 });
  const rows = await db
    .select(scheduleColumns)
    .from(recurringSchedules)
    .where(where)
    .orderBy(
      sql`case ${recurringSchedules.status} when 'active' then 0 when 'paused' then 1 else 2 end`,
      asc(recurringSchedules.nextRunOn),
      desc(recurringSchedules.id),
    )
    .limit(window.pageSize)
    .offset(window.offset);

  const [names, lineRows] = await Promise.all([
    getCustomerNames(
      actor,
      rows.map((row) => row.customerId),
      db,
    ),
    rows.length === 0
      ? Promise.resolve([])
      : db
          .select({
            scheduleId: recurringScheduleLines.scheduleId,
            position: recurringScheduleLines.position,
            description: recurringScheduleLines.description,
            unitLabel: recurringScheduleLines.unitLabel,
            quantity: recurringScheduleLines.quantity,
            unitPriceMinor: recurringScheduleLines.unitPriceMinor,
            discountKind: recurringScheduleLines.discountKind,
            discountValue: recurringScheduleLines.discountValue,
            taxRateId: recurringScheduleLines.taxRateId,
            taxRateName: recurringScheduleLines.taxRateName,
            taxRateBps: recurringScheduleLines.taxRateBps,
            sourceKind: recurringScheduleLines.sourceKind,
            sourceId: recurringScheduleLines.sourceId,
          })
          .from(recurringScheduleLines)
          .where(
            inArray(
              recurringScheduleLines.scheduleId,
              rows.map((row) => row.id),
            ),
          ),
  ]);
  const linesOf = new Map<string, ScheduleLine[]>();
  for (const { scheduleId, ...line } of lineRows) {
    linesOf.set(scheduleId, [
      ...(linesOf.get(scheduleId) ?? []),
      { ...line, quantity: numericToQuantity(line.quantity) },
    ]);
  }
  return {
    schedules: rows.map((row) => ({
      id: row.id,
      customerId: row.customerId,
      customerName: names.get(row.customerId) ?? null,
      frequency: row.frequency,
      anchorDay: row.anchorDay,
      anchorMonth: row.anchorMonth,
      nextRunOn: row.nextRunOn,
      draftsCreated: row.draftsCreated,
      status: row.status,
      currency: row.currency,
      totalMinor: totalOf(row.taxMode, linesOf.get(row.id) ?? []),
    })),
    ...pageMeta(window),
    total: total?.value ?? 0,
  };
}

/** Why Tavi paused a schedule itself, in words the business can act on. */
export const RECURRING_PAUSE_REASONS = {
  customerGone: "The customer was archived, so no more statements are made. Restore the customer, then resume.",
  taxRateGone: "A tax rate on its lines was archived, so no more statements are made. End this schedule and repeat a current bill.",
} as const;

type RunResult = "created" | "paused" | "skipped";

/**
 * Makes the draft a schedule owes for `today`, in one transaction under the schedule's lock, so overlapping runs
 * cannot make two. Nothing here is a person acting: the audit rows say "system", the draft has no creator and no number.
 */
async function runSchedule(organizationId: string, scheduleId: string, today: CalendarDate, db: Database): Promise<RunResult> {
  return db.transaction(async (tx): Promise<RunResult> => {
    const current = await loadSchedule(tx, { organizationId }, scheduleId, true);
    if (!current || current.status !== "active" || compareDates(current.nextRunOn, today) > 0) return "skipped";
    const rule = recurrenceOf(current);
    const system = { actorType: "system", organizationId, entityType: "recurring_schedule", entityId: current.id } as const;

    const pause = async (reason: string): Promise<RunResult> => {
      await tx.update(recurringSchedules).set({ status: "paused", pauseReason: reason }).where(eq(recurringSchedules.id, current.id));
      await recordAuditEvent(tx, { ...system, action: "recurring.paused", metadata: { reason } });
      return "paused";
    };
    const end = async (): Promise<RunResult> => {
      await tx.update(recurringSchedules).set({ status: "ended" }).where(eq(recurringSchedules.id, current.id));
      await recordAuditEvent(tx, { ...system, action: "recurring.ended", metadata: { reason: "end date reached" } });
      return "skipped";
    };

    // Nothing is made after the end date: a due date that falls beyond it only ends the schedule.
    if (current.endsOn !== null && compareDates(current.nextRunOn, current.endsOn) > 0) return end();

    if (!(await customerIsActive(organizationId, current.customerId, tx))) return pause(RECURRING_PAUSE_REASONS.customerGone);
    const [lines, rates] = await Promise.all([loadScheduleLines(tx, current.id), activeTaxRates(organizationId, tx)]);
    if (lines.some((line) => line.taxRateId !== null && !rates.has(line.taxRateId))) return pause(RECURRING_PAUSE_REASONS.taxRateGone);

    // Rates are the ones saved in the schedule; the catalog is only asked whether they are still in use.
    const resolved = lines.map((line) => ({ ...toParsedLine(line), tax: savedTax(line) }));
    const calculated = calculate(current.taxMode, resolved);
    if (!calculated.ok) throw new Error("A recurring bill is too large to total");
    const { amounts } = calculated;

    // The latest due date that has come (but not past the end date) is the one this draft is for.
    const through = current.endsOn !== null && compareDates(current.endsOn, today) < 0 ? current.endsOn : today;
    const { latest, next } = advancePast(rule, current.nextRunOn, through);

    const [draft] = await tx
      .insert(invoices)
      .values({
        organizationId,
        customerId: current.customerId,
        currency: current.currency,
        taxMode: current.taxMode,
        issueDate: today,
        dueDate: addDays(today, current.termsDays),
        notes: current.notes,
        terms: current.terms,
        createdBy: null,
        recurringScheduleId: current.id,
        recurringForDate: latest,
        ...headerAmounts(amounts, null),
      })
      .onConflictDoNothing({ target: [invoices.recurringScheduleId, invoices.recurringForDate] })
      .returning({ id: invoices.id });

    if (draft) {
      if (resolved.length > 0) await tx.insert(invoiceLines).values(lineRows({ organizationId, invoiceId: draft.id }, resolved, amounts));
      await recordAuditEvent(tx, { ...system, entityType: "invoice", entityId: draft.id, action: "invoice.created", metadata: { recurringScheduleId: current.id } });
      await recordAuditEvent(tx, { ...system, action: "recurring.draft_created", metadata: { invoiceId: draft.id, forDate: latest } });
    }

    const draftsCreated = current.draftsCreated + (draft ? 1 : 0);
    const finished = isFinished({ endsOn: current.endsOn, maxDrafts: current.maxDrafts, draftsCreated }, next);
    await tx
      .update(recurringSchedules)
      .set({ nextRunOn: next, draftsCreated, lastRunOn: today, ...(finished ? { status: "ended" as const } : {}) })
      .where(eq(recurringSchedules.id, current.id));
    if (finished) await recordAuditEvent(tx, { ...system, action: "recurring.ended", metadata: { reason: "last statement made" } });
    return draft ? "created" : "skipped";
  });
}

/**
 * The daily job's step for one business: every active schedule due on or before `today` (the business's own date)
 * gets its draft. Idempotent; one schedule's failure is logged and never stops the others.
 */
export async function runDueSchedules(
  organizationId: string,
  today: CalendarDate,
  db: Database = getDb(),
): Promise<{ created: number; paused: number }> {
  const due = await db
    .select({ id: recurringSchedules.id })
    .from(recurringSchedules)
    .where(
      and(
        eq(recurringSchedules.organizationId, organizationId),
        eq(recurringSchedules.status, "active"),
        sql`${recurringSchedules.nextRunOn} <= ${today}`,
      ),
    )
    .orderBy(asc(recurringSchedules.nextRunOn), asc(recurringSchedules.id));

  const result = { created: 0, paused: 0 };
  for (const { id } of due) {
    try {
      const outcome = await runSchedule(organizationId, id, today, db);
      if (outcome === "created") result.created += 1;
      if (outcome === "paused") result.paused += 1;
    } catch (error) {
      logger.error("recurring schedule failed", { organizationId, scheduleId: id, error });
    }
  }
  return result;
}
