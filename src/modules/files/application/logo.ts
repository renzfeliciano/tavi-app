import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { type Database, getDb } from "@/db";
import { recordAuditEvent } from "@/modules/audit";
import { assertCan, type OrgActor } from "@/modules/authz";
import { logger } from "@/shared/logger";
import { detectImageType } from "../domain/image-type";
import { MAX_STORED_FILE_BYTES, MAX_UPLOAD_BYTES, UPLOAD_MESSAGES } from "../domain/limits";
import { normalizeLogo } from "../infra/image";
import { files } from "../schema";

export type LogoInfo = { id: string; width: number; height: number; updatedAt: Date };
export type UploadLogoResult = { ok: true; logo: LogoInfo } | { ok: false; error: string };

const log = logger.child({ module: "files" });

const isLogoOf = (actor: OrgActor) =>
  and(eq(files.organizationId, actor.organizationId), eq(files.purpose, "logo"));

const logoInfo = {
  id: files.id,
  width: files.width,
  height: files.height,
  updatedAt: files.updatedAt,
};

/** The organization's logo (without its bytes), or null. */
export async function getOrganizationLogo(
  actor: OrgActor,
  db: Database = getDb(),
): Promise<LogoInfo | null> {
  const [row] = await db.select(logoInfo).from(files).where(isLogoOf(actor));
  return row ?? null;
}

/** The logo's bytes, only if `fileId` is the actor's organization's logo. */
export async function readLogoFile(actor: OrgActor, fileId: string, db: Database = getDb()) {
  if (!z.uuid().safeParse(fileId).success) return null;
  const [row] = await db
    .select({ data: files.data, contentType: files.contentType, sha256: files.sha256 })
    .from(files)
    .where(and(eq(files.id, fileId), isLogoOf(actor)));
  return row ?? null;
}

/**
 * Validates, re-encodes and stores a new logo, replacing the old one. The
 * bytes are identified by their content, never by file name or declared type,
 * and SVG is refused (it can carry scripts).
 */
export async function uploadOrganizationLogo(
  actor: OrgActor,
  bytes: Uint8Array,
  db: Database = getDb(),
): Promise<UploadLogoResult> {
  assertCan(actor, "organization.manage");
  if (bytes.byteLength === 0) return { ok: false, error: UPLOAD_MESSAGES.empty };
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, error: UPLOAD_MESSAGES.tooLarge };
  }
  if (!detectImageType(bytes)) return { ok: false, error: UPLOAD_MESSAGES.wrongType };

  let image;
  try {
    image = await normalizeLogo(bytes);
  } catch (error) {
    log.info("logo could not be decoded", { error });
    return { ok: false, error: "We couldn't read that image. Try saving it again as a PNG or JPG." };
  }
  if (image.data.byteLength > MAX_STORED_FILE_BYTES) {
    return { ok: false, error: "That image is too detailed to use as a logo. Try a simpler one." };
  }

  const logo = await db.transaction(async (tx) => {
    await tx.delete(files).where(isLogoOf(actor));
    const [row] = await tx
      .insert(files)
      .values({
        organizationId: actor.organizationId,
        purpose: "logo",
        contentType: image.contentType,
        byteSize: image.data.byteLength,
        width: image.width,
        height: image.height,
        sha256: createHash("sha256").update(image.data).digest("hex"),
        data: image.data,
        uploadedBy: actor.userId,
      })
      .returning(logoInfo);
    if (!row) throw new Error("Logo insert returned no row");
    await recordAuditEvent(tx, {
      action: "organization.logo_updated",
      actorType: "user",
      actorId: actor.userId,
      organizationId: actor.organizationId,
      entityType: "organization",
      entityId: actor.organizationId,
      metadata: { fileId: row.id, contentType: image.contentType, byteSize: image.data.byteLength },
    });
    return row;
  });

  return { ok: true, logo };
}

export async function removeOrganizationLogo(actor: OrgActor, db: Database = getDb()): Promise<void> {
  assertCan(actor, "organization.manage");
  await db.transaction(async (tx) => {
    const removed = await tx.delete(files).where(isLogoOf(actor)).returning({ id: files.id });
    if (removed.length === 0) return;
    await recordAuditEvent(tx, {
      action: "organization.logo_removed",
      actorType: "user",
      actorId: actor.userId,
      organizationId: actor.organizationId,
      entityType: "organization",
      entityId: actor.organizationId,
      metadata: { fileId: removed[0]?.id },
    });
  });
}

/**
 * The logo for a document opened from a customer link. There is no signed-in
 * user: callers must first resolve a valid share link for this organization.
 */
export async function readLogoForSharedDocument(organizationId: string, db: Database = getDb()) {
  const [row] = await db
    .select({
      data: files.data,
      contentType: files.contentType,
      sha256: files.sha256,
      width: files.width,
      height: files.height,
    })
    .from(files)
    .where(and(eq(files.organizationId, organizationId), eq(files.purpose, "logo")));
  return row ?? null;
}
