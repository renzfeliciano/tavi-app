import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { type Database, getDb } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import { assertCan, type OrgActor } from "@/modules/authz";
import { numberingInputSchema } from "../domain/numbering-input";
import {
  DEFAULT_NUMBERING,
  DOCUMENT_KINDS,
  type DocumentKind,
  formatDocumentNumber,
} from "../domain/numbering";
import { documentSequences } from "../schema";

export type DocumentNumbering = {
  kind: DocumentKind;
  prefix: string;
  padding: number;
  /** The sequence value the next issued document will get. */
  nextValue: number;
  /** What the next issued document will be numbered. */
  nextNumber: string;
};

export type UpdateNumberingResult =
  | { ok: true }
  | { ok: false; fieldErrors: Partial<Record<"prefix" | "padding", string[]>> };

/** The numbering format of each document kind, with the number the next one will get. */
export async function getDocumentNumbering(
  actor: OrgActor,
  db: Database = getDb(),
): Promise<DocumentNumbering[]> {
  const rows = await db
    .select({
      kind: documentSequences.kind,
      prefix: documentSequences.prefix,
      padding: documentSequences.padding,
      nextValue: documentSequences.nextValue,
    })
    .from(documentSequences)
    .where(eq(documentSequences.organizationId, actor.organizationId));

  return DOCUMENT_KINDS.map((kind) => {
    const row = rows.find((r) => r.kind === kind);
    const format = row ?? DEFAULT_NUMBERING[kind];
    const nextValue = row?.nextValue ?? 1;
    return {
      kind,
      prefix: format.prefix,
      padding: format.padding,
      nextValue,
      nextNumber: formatDocumentNumber(format, nextValue),
    };
  });
}

/**
 * Changes the prefix and digit count of future numbers. The sequence itself
 * is never reset, so a number can't be issued twice (§B.6).
 */
export async function updateDocumentNumbering(
  actor: OrgActor,
  kind: DocumentKind,
  input: unknown,
  db: Database = getDb(),
): Promise<UpdateNumberingResult> {
  assertCan(actor, "organization.manage");
  const parsed = numberingInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const next = parsed.data;

  await db.transaction(async (tx) => {
    // Make sure the row exists (nothing issued yet: next value 1), then lock it.
    await tx
      .insert(documentSequences)
      .values({ organizationId: actor.organizationId, kind, ...DEFAULT_NUMBERING[kind], nextValue: 1 })
      .onConflictDoNothing();
    const where = and(
      eq(documentSequences.organizationId, actor.organizationId),
      eq(documentSequences.kind, kind),
    );
    const [current] = await tx
      .select({ prefix: documentSequences.prefix, padding: documentSequences.padding })
      .from(documentSequences)
      .where(where)
      .for("update");
    if (!current) throw new Error("Document sequence missing after insert");
    if (current.prefix === next.prefix && current.padding === next.padding) return;

    await tx.update(documentSequences).set(next).where(where);
    await recordAuditEvent(tx, {
      action: "numbering.updated",
      actorType: "user",
      actorId: actor.userId,
      organizationId: actor.organizationId,
      entityType: "document_sequence",
      metadata: { kind, before: current, after: next },
    });
  });

  return { ok: true };
}
