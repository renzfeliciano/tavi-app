import { and, eq, isNull, sql } from "drizzle-orm";
import type { MarketProfile } from "@/config/markets";
import { type Database, type Executor, getDb } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import { assertCan, type OrgActor } from "@/modules/authz";
import { getDocumentSettings } from "@/modules/organizations";
import { todayIn } from "@/shared/dates/calendar";
import { type InvoiceRegistration, type InvoiceRegistrationSnapshot, parseInvoiceRegistration } from "../domain/registration";
import { invoiceRegistrations } from "../schema";

// Invoice mode (D13, D14, 1.12): the business's registered invoicing system
// and its serial counter. Saving is an owner/admin change (`organization.manage`),
// audited with before and after; serials are claimed inside the issuing
// transaction under a row lock, so they're gapless and never reused.

export type InvoiceRegistrationView = InvoiceRegistration & { nextSerial: number; active: boolean };

export type SaveInvoiceRegistrationResult = { ok: true } | { ok: false; errors: Record<string, string> };

const columns = {
  number: invoiceRegistrations.number,
  issuedOn: invoiceRegistrations.issuedOn,
  seriesStart: invoiceRegistrations.seriesStart,
  seriesEnd: invoiceRegistrations.seriesEnd,
  title: invoiceRegistrations.title,
  nextSerial: invoiceRegistrations.nextSerial,
  turnedOffAt: invoiceRegistrations.turnedOffAt,
};

const ofOrganization = (organizationId: string) => eq(invoiceRegistrations.organizationId, organizationId);

/** The business's registration (on or off), or null if it never entered one. */
export async function getInvoiceRegistration(actor: OrgActor, db: Database = getDb()): Promise<InvoiceRegistrationView | null> {
  assertCan(actor, "invoices.read");
  const [row] = await db.select(columns).from(invoiceRegistrations).where(ofOrganization(actor.organizationId));
  if (!row) return null;
  const { turnedOffAt, ...rest } = row;
  return { ...rest, active: turnedOffAt === null };
}

/** Whether the business issues registered invoices right now (invoice mode). */
export async function invoiceModeOn(organizationId: string, db: Executor = getDb()): Promise<boolean> {
  const [row] = await db
    .select({ on: sql<number>`1` })
    .from(invoiceRegistrations)
    .where(and(ofOrganization(organizationId), isNull(invoiceRegistrations.turnedOffAt)));
  return Boolean(row);
}

/** Enters or updates the registration and turns invoice mode on. */
export async function saveInvoiceRegistration(
  actor: OrgActor,
  input: unknown,
  { market, now = new Date() }: { market: MarketProfile; now?: Date },
  db: Database = getDb(),
): Promise<SaveInvoiceRegistrationResult> {
  assertCan(actor, "organization.manage");
  const settings = await getDocumentSettings(actor, db);
  return db.transaction(async (tx): Promise<SaveInvoiceRegistrationResult> => {
    const [current] = await tx
      .select(columns)
      .from(invoiceRegistrations)
      .where(ofOrganization(actor.organizationId))
      .for("update");
    const lastIssuedSerial = current && current.nextSerial > 1 ? current.nextSerial - 1 : null;
    const parsed = parseInvoiceRegistration(input, { market, today: todayIn(settings.timezone, now), lastIssuedSerial });
    if (!parsed.ok) return parsed;
    const next = parsed.registration;
    // The counter only moves forward: a later series starts at its own first serial.
    const nextSerial = Math.max(current?.nextSerial ?? next.seriesStart, next.seriesStart);
    await tx
      .insert(invoiceRegistrations)
      .values({ organizationId: actor.organizationId, ...next, nextSerial })
      .onConflictDoUpdate({
        target: invoiceRegistrations.organizationId,
        set: { ...next, nextSerial, turnedOffAt: null, updatedAt: sql`now()` },
      });
    await recordAuditEvent(tx, {
      action: "invoice.registration_saved",
      actorType: "user",
      actorId: actor.userId,
      organizationId: actor.organizationId,
      entityType: "organization",
      entityId: actor.organizationId,
      metadata: { before: current ?? null, after: { ...next, nextSerial } },
    });
    return { ok: true };
  });
}

/** Turns invoice mode off: new bills are billing statements again. Issued invoices stay as they are. */
export async function turnOffInvoiceRegistration(actor: OrgActor, db: Database = getDb()): Promise<{ ok: true } | { ok: false; notFound: true }> {
  assertCan(actor, "organization.manage");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(invoiceRegistrations)
      .set({ turnedOffAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(ofOrganization(actor.organizationId), isNull(invoiceRegistrations.turnedOffAt)))
      .returning({ number: invoiceRegistrations.number });
    if (!row) return { ok: false as const, notFound: true as const };
    await recordAuditEvent(tx, {
      action: "invoice.registration_turned_off",
      actorType: "user",
      actorId: actor.userId,
      organizationId: actor.organizationId,
      entityType: "organization",
      entityId: actor.organizationId,
      metadata: { number: row.number },
    });
    return { ok: true as const };
  });
}

/**
 * Takes the next serial for a registered invoice, inside the issuing
 * transaction (the row stays locked until it commits; a rollback gives the
 * serial back). Null when invoice mode is off; `exhausted` when the approved
 * series is used up, in which case nothing changes.
 */
export async function claimRegisteredSerial(
  tx: Executor,
  organizationId: string,
): Promise<InvoiceRegistrationSnapshot | { exhausted: true; seriesEnd: number } | null> {
  const [row] = await tx
    .select(columns)
    .from(invoiceRegistrations)
    .where(and(ofOrganization(organizationId), isNull(invoiceRegistrations.turnedOffAt)))
    .for("update");
  if (!row) return null;
  if (row.nextSerial > row.seriesEnd) return { exhausted: true, seriesEnd: row.seriesEnd };
  await tx
    .update(invoiceRegistrations)
    .set({ nextSerial: row.nextSerial + 1, updatedAt: sql`now()` })
    .where(ofOrganization(organizationId));
  const { number, issuedOn, seriesStart, seriesEnd, title, nextSerial } = row;
  return { number, issuedOn, seriesStart, seriesEnd, title, serial: nextSerial };
}
