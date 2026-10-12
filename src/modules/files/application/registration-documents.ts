import { createHash } from "node:crypto";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { type Database, getDb } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import { assertCan, can, type OrgActor } from "@/modules/authz";
import { logger } from "@/shared/logger";
import { cleanFileName } from "../domain/document-name";
import { detectImageType, isPdf } from "../domain/image-type";
import { DOCUMENT_MESSAGES, MAX_UPLOAD_BYTES, REGISTRATION_DOCUMENTS } from "../domain/limits";
import { normalizeDocumentImage } from "../infra/image";
import { files } from "../schema";

// The certificate folder (BIR, DTI, permits). Only owners and admins can see
// or change it: these papers carry tax numbers and home addresses.

const log = logger.child({ module: "files" });

export type RegistrationDocument = {
  id: string;
  kind: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  createdAt: Date;
};

export type UploadDocumentResult = { ok: true; document: RegistrationDocument } | { ok: false; error: string };

const documentColumns = {
  id: files.id,
  kind: sql<string>`${files.docKind}`,
  fileName: sql<string>`${files.fileName}`,
  contentType: files.contentType,
  byteSize: files.byteSize,
  createdAt: files.createdAt,
};

const isDocumentOf = (actor: OrgActor) =>
  and(eq(files.organizationId, actor.organizationId), eq(files.purpose, "registration"));

/** The business's documents, newest first. Owners and admins only. */
export async function listRegistrationDocuments(actor: OrgActor, db: Database = getDb()): Promise<RegistrationDocument[]> {
  assertCan(actor, "organization.manage");
  return db.select(documentColumns).from(files).where(isDocumentOf(actor)).orderBy(desc(files.createdAt));
}

/**
 * Stores a certificate. A PDF is kept as it came (checked by its first bytes);
 * a photo or scan is re-encoded from pixels. `kinds` are the document kinds
 * the business's market allows.
 */
export async function uploadRegistrationDocument(
  actor: OrgActor,
  input: { bytes: Uint8Array; kind: string; fileName: string },
  kinds: readonly string[],
  db: Database = getDb(),
): Promise<UploadDocumentResult> {
  assertCan(actor, "organization.manage");
  const { bytes } = input;
  if (bytes.byteLength === 0) return { ok: false, error: DOCUMENT_MESSAGES.empty };
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return { ok: false, error: DOCUMENT_MESSAGES.tooLarge };
  if (!kinds.includes(input.kind)) return { ok: false, error: DOCUMENT_MESSAGES.kind };

  let stored: { data: Buffer | Uint8Array; contentType: string; width: number | null; height: number | null };
  if (isPdf(bytes)) {
    stored = { data: bytes, contentType: "application/pdf", width: null, height: null };
  } else if (detectImageType(bytes)) {
    try {
      stored = await normalizeDocumentImage(bytes);
    } catch (error) {
      log.info("registration document could not be decoded", { error });
      return { ok: false, error: DOCUMENT_MESSAGES.unreadable };
    }
  } else {
    return { ok: false, error: DOCUMENT_MESSAGES.wrongType };
  }
  const fileName = cleanFileName(input.fileName, input.kind);
  const data = Buffer.from(stored.data);

  return db.transaction(async (tx): Promise<UploadDocumentResult> => {
    // The business row serializes uploads, so two at once can't both pass the limit.
    await tx.execute(sql`select 1 from organizations where id = ${actor.organizationId} for update`);
    const [{ total } = { total: 0 }] = await tx.select({ total: count() }).from(files).where(isDocumentOf(actor));
    if (total >= REGISTRATION_DOCUMENTS.maxPerBusiness) return { ok: false, error: DOCUMENT_MESSAGES.full };

    const [row] = await tx
      .insert(files)
      .values({
        organizationId: actor.organizationId,
        purpose: "registration",
        contentType: stored.contentType,
        byteSize: data.byteLength,
        width: stored.width,
        height: stored.height,
        docKind: input.kind,
        fileName,
        sha256: createHash("sha256").update(data).digest("hex"),
        data,
        uploadedBy: actor.userId,
      })
      .returning(documentColumns);
    if (!row) throw new Error("Document insert returned no row");
    // The log records that a document was added and what kind, never its name or contents.
    await recordAuditEvent(tx, {
      action: "organization.document_uploaded",
      actorType: "user",
      actorId: actor.userId,
      organizationId: actor.organizationId,
      entityType: "organization",
      entityId: actor.organizationId,
      metadata: { fileId: row.id, kind: input.kind, contentType: stored.contentType, byteSize: data.byteLength },
    });
    return { ok: true, document: row };
  });
}

/** Removes a document. Returns false if it isn't there (or isn't this business's). */
export async function removeRegistrationDocument(actor: OrgActor, fileId: string, db: Database = getDb()): Promise<boolean> {
  assertCan(actor, "organization.manage");
  if (!z.uuid().safeParse(fileId).success) return false;
  return db.transaction(async (tx) => {
    const removed = await tx
      .delete(files)
      .where(and(eq(files.id, fileId), isDocumentOf(actor)))
      .returning({ id: files.id, kind: files.docKind });
    const [row] = removed;
    if (!row) return false;
    await recordAuditEvent(tx, {
      action: "organization.document_removed",
      actorType: "user",
      actorId: actor.userId,
      organizationId: actor.organizationId,
      entityType: "organization",
      entityId: actor.organizationId,
      metadata: { fileId: row.id, kind: row.kind },
    });
    return true;
  });
}

export type OrganizationFile = {
  data: Buffer;
  contentType: string;
  sha256: string;
  purpose: "logo" | "registration" | "withholding_certificate";
  fileName: string | null;
};

/**
 * A stored file's bytes for the people allowed to see it: the logo is for
 * every member, a registration document for owners and admins only, and a
 * withholding certificate scan for anyone who can read payments.
 */
export async function readOrganizationFile(actor: OrgActor, fileId: string, db: Database = getDb()): Promise<OrganizationFile | null> {
  if (!z.uuid().safeParse(fileId).success) return null;
  const [row] = await db
    .select({
      data: files.data,
      contentType: files.contentType,
      sha256: files.sha256,
      purpose: files.purpose,
      fileName: files.fileName,
    })
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.organizationId, actor.organizationId)));
  if (!row) return null;
  if (row.purpose === "registration" && !can(actor, "organization.manage")) return null;
  if (row.purpose === "withholding_certificate" && !can(actor, "payments.read")) return null;
  return row;
}
