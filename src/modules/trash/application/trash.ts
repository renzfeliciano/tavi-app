import { and, desc, eq, gt, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import { type Database, type Executor, getDb } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import { assertCan, can, type OrgActor } from "@/modules/authz";
import { TRASH_KINDS, type TrashKind, trashDaysLeft, trashExpiry, trashKindCapability } from "../domain/trash";
import { trashItems } from "../schema";

// The recycle bin's storage (D27). The invoices and quotes modules put a draft
// here when it is deleted and take it back when it is restored, inside their
// own transaction; this module knows nothing about what a payload holds.

export type TrashEntryInput = {
  kind: TrashKind;
  originalId: string;
  customerName: string | null;
  totalMinor: number;
  currency: string;
  payload: unknown;
};

export type TrashItem = {
  id: string;
  kind: TrashKind;
  originalId: string;
  customerName: string | null;
  totalMinor: number;
  currency: string;
  deletedAt: Date;
  expiresAt: Date;
  daysLeft: number;
};

export type TakenTrashItem = { originalId: string; payload: unknown };

const isUuid = (id: string) => z.uuid().safeParse(id).success;
const ofOrganization = (actor: Pick<OrgActor, "organizationId">) => eq(trashItems.organizationId, actor.organizationId);

/** Keeps a deleted draft; returns the bin item's id. The caller has checked who may delete it. */
export async function putInTrash(
  tx: Executor,
  actor: OrgActor,
  entry: TrashEntryInput,
  now: Date = new Date(),
): Promise<string> {
  const [row] = await tx
    .insert(trashItems)
    .values({
      organizationId: actor.organizationId,
      kind: entry.kind,
      originalId: entry.originalId,
      customerName: entry.customerName,
      totalMinor: entry.totalMinor,
      currency: entry.currency,
      payload: entry.payload,
      deletedBy: actor.userId,
      deletedAt: now,
      expiresAt: trashExpiry(now),
    })
    .returning({ id: trashItems.id });
  if (!row) throw new Error("Moving a draft to the recycle bin returned no row");
  return row.id;
}

/**
 * Takes an item out of the bin to restore it: null when it's gone, has lapsed,
 * is another kind, or is another business's. Locks the row, so two people
 * restoring at once can't both succeed. The caller has checked who may restore it.
 */
export async function takeFromTrash(
  tx: Executor,
  actor: OrgActor,
  kind: TrashKind,
  trashId: string,
  now: Date = new Date(),
): Promise<TakenTrashItem | null> {
  if (!isUuid(trashId)) return null;
  const [row] = await tx
    .select({ id: trashItems.id, originalId: trashItems.originalId, payload: trashItems.payload })
    .from(trashItems)
    .where(
      and(eq(trashItems.id, trashId), ofOrganization(actor), eq(trashItems.kind, kind), gt(trashItems.expiresAt, now)),
    )
    .for("update");
  if (!row) return null;
  await tx.delete(trashItems).where(eq(trashItems.id, row.id));
  return { originalId: row.originalId, payload: row.payload };
}

/** What's in the bin, newest first: only the kinds this person may restore, and nothing that has lapsed. */
export async function listTrash(actor: OrgActor, db: Database = getDb(), now: Date = new Date()): Promise<TrashItem[]> {
  const kinds = TRASH_KINDS.filter((kind) => can(actor, trashKindCapability(kind)));
  if (kinds.length === 0) return [];
  const rows = await db
    .select({
      id: trashItems.id,
      kind: trashItems.kind,
      originalId: trashItems.originalId,
      customerName: trashItems.customerName,
      totalMinor: trashItems.totalMinor,
      currency: trashItems.currency,
      deletedAt: trashItems.deletedAt,
      expiresAt: trashItems.expiresAt,
    })
    .from(trashItems)
    .where(and(ofOrganization(actor), inArray(trashItems.kind, kinds), gt(trashItems.expiresAt, now)))
    .orderBy(desc(trashItems.deletedAt), desc(trashItems.id));
  return rows.map((row) => ({ ...row, daysLeft: trashDaysLeft(row.expiresAt, now) }));
}

function audit(tx: Executor, actor: OrgActor, action: "trash.item_deleted" | "trash.emptied", metadata: Record<string, unknown>) {
  return recordAuditEvent(tx, {
    action,
    actorType: "user",
    actorId: actor.userId,
    organizationId: actor.organizationId,
    entityType: "organization",
    entityId: actor.organizationId,
    metadata,
  });
}

/** Deletes one item for good. Owners and admins only. */
export async function discardTrashItem(
  actor: OrgActor,
  trashId: string,
  db: Database = getDb(),
): Promise<{ ok: true } | { ok: false; notFound: true }> {
  assertCan(actor, "organization.manage");
  if (!isUuid(trashId)) return { ok: false, notFound: true };
  return db.transaction(async (tx) => {
    const [row] = await tx
      .delete(trashItems)
      .where(and(eq(trashItems.id, trashId), ofOrganization(actor)))
      .returning({ kind: trashItems.kind, customerName: trashItems.customerName, totalMinor: trashItems.totalMinor });
    if (!row) return { ok: false as const, notFound: true as const };
    await audit(tx, actor, "trash.item_deleted", { kind: row.kind, customerName: row.customerName, totalMinor: row.totalMinor });
    return { ok: true as const };
  });
}

/** Deletes everything in the business's bin for good. Owners and admins only. */
export async function emptyTrash(actor: OrgActor, db: Database = getDb()): Promise<{ ok: true; removed: number }> {
  assertCan(actor, "organization.manage");
  return db.transaction(async (tx) => {
    const rows = await tx.delete(trashItems).where(ofOrganization(actor)).returning({ id: trashItems.id });
    if (rows.length > 0) await audit(tx, actor, "trash.emptied", { removed: rows.length });
    return { ok: true as const, removed: rows.length };
  });
}

/**
 * The daily job's cleanup: removes every lapsed item in every business and
 * records, per business, how many went. Returns the total. Idempotent.
 */
export async function purgeExpiredTrash(db: Database = getDb(), now: Date = new Date()): Promise<number> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .delete(trashItems)
      .where(lte(trashItems.expiresAt, now))
      .returning({ organizationId: trashItems.organizationId });
    const perBusiness = new Map<string, number>();
    for (const { organizationId } of rows) perBusiness.set(organizationId, (perBusiness.get(organizationId) ?? 0) + 1);
    for (const [organizationId, removed] of perBusiness) {
      await recordAuditEvent(tx, {
        action: "trash.purged",
        actorType: "system",
        organizationId,
        entityType: "organization",
        entityId: organizationId,
        metadata: { removed },
      });
    }
    return rows.length;
  });
}
