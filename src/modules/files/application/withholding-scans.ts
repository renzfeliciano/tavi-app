import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { type Database, type Executor, getDb } from "@/db";
import { assertCan, type OrgActor } from "@/modules/authz";
import { logger } from "@/shared/logger";
import { cleanFileName } from "../domain/document-name";
import { detectImageType, isPdf } from "../domain/image-type";
import { DOCUMENT_MESSAGES, MAX_UPLOAD_BYTES } from "../domain/limits";
import { normalizeDocumentImage } from "../infra/image";
import { files } from "../schema";

// The scan or photo of a withholding certificate (BIR Form 2307). It lives in
// the files store beside the registration folder but is not part of it: no
// document kind, no per-business limit, and anyone who can read payments can
// open it. The certificate's own audit event records that a scan is attached.

const log = logger.child({ module: "files" });

export type UploadScanResult =
  | { ok: true; fileId: string; fileName: string; contentType: string }
  | { ok: false; error: string };

/**
 * Stores a scan. A PDF is kept as it came (checked by its first bytes); a
 * photo or scan is re-encoded from pixels. Needs `payments.record`.
 */
export async function uploadWithholdingScan(
  actor: OrgActor,
  input: { bytes: Uint8Array; fileName: string },
  db: Database = getDb(),
): Promise<UploadScanResult> {
  assertCan(actor, "payments.record");
  const { bytes } = input;
  if (bytes.byteLength === 0) return { ok: false, error: DOCUMENT_MESSAGES.empty };
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return { ok: false, error: DOCUMENT_MESSAGES.tooLarge };

  let stored: { data: Buffer | Uint8Array; contentType: string; width: number | null; height: number | null };
  if (isPdf(bytes)) {
    stored = { data: bytes, contentType: "application/pdf", width: null, height: null };
  } else if (detectImageType(bytes)) {
    try {
      stored = await normalizeDocumentImage(bytes);
    } catch (error) {
      log.info("withholding scan could not be decoded", { error });
      return { ok: false, error: DOCUMENT_MESSAGES.unreadable };
    }
  } else {
    return { ok: false, error: DOCUMENT_MESSAGES.wrongType };
  }
  const fileName = cleanFileName(input.fileName, "2307");
  const data = Buffer.from(stored.data);

  const [row] = await db
    .insert(files)
    .values({
      organizationId: actor.organizationId,
      purpose: "withholding_certificate",
      contentType: stored.contentType,
      byteSize: data.byteLength,
      width: stored.width,
      height: stored.height,
      fileName,
      sha256: createHash("sha256").update(data).digest("hex"),
      data,
      uploadedBy: actor.userId,
    })
    .returning({ id: files.id });
  if (!row) throw new Error("Withholding scan insert returned no row");
  return { ok: true, fileId: row.id, fileName, contentType: stored.contentType };
}

/**
 * Deletes a scan of this business. Anything else (another business's file, a
 * logo, a registration document) is left alone. It writes no audit event and
 * checks no capability: the caller runs it inside its own authorised
 * transaction, and its event covers the change.
 */
export async function removeWithholdingScan(executor: Executor, actor: OrgActor, fileId: string): Promise<void> {
  if (!z.uuid().safeParse(fileId).success) return;
  await executor
    .delete(files)
    .where(
      and(eq(files.id, fileId), eq(files.organizationId, actor.organizationId), eq(files.purpose, "withholding_certificate")),
    );
}
