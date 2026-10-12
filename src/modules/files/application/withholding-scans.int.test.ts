import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestOrganization, createTestUser, listAllAuditEvents, resetTables, testDb } from "@/db/testing";
import { ForbiddenError, type OrgActor, type Role } from "@/modules/authz";
import { DOCUMENT_MESSAGES, MAX_UPLOAD_BYTES } from "../domain/limits";
import { readOrganizationFile, uploadRegistrationDocument } from "./registration-documents";
import { removeWithholdingScan, uploadWithholdingScan } from "./withholding-scans";

// The scan of a 2307 certificate: stored in the files store with its own
// purpose, readable by anyone who can read payments, never part of the
// registration folder.

async function actorFor(role: Role = "owner", organizationId?: string): Promise<OrgActor> {
  const orgId = organizationId ?? (await createTestOrganization()).id;
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com` });
  return { organizationId: orgId, userId: user.id, role };
}

const pdf = () => new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF");
const png = () => sharp({ create: { width: 600, height: 800, channels: 3, background: { r: 250, g: 250, b: 250 } } }).png().toBuffer();

beforeEach(async () => {
  await resetTables();
});
afterAll(async () => {
  await closeTestDb();
});

describe("uploadWithholdingScan", () => {
  it("keeps a PDF as it came, under a cleaned name, and anyone who can read payments can open it", async () => {
    const owner = await actorFor();
    const bytes = pdf();

    const result = await uploadWithholdingScan(owner, { bytes, fileName: "C:\\scans\\2307 Q3.pdf" }, testDb());

    expect(result).toMatchObject({ ok: true, fileName: "2307 Q3.pdf", contentType: "application/pdf" });
    const fileId = result.ok ? result.fileId : "";
    const member = await actorFor("member", owner.organizationId);
    for (const reader of [owner, member]) {
      const file = await readOrganizationFile(reader, fileId, testDb());
      expect(file).toMatchObject({ purpose: "withholding_certificate", fileName: "2307 Q3.pdf", contentType: "application/pdf" });
      expect(file?.data.byteLength).toBe(bytes.byteLength);
    }
  });

  it("stores a photo or scan as an image", async () => {
    const owner = await actorFor();
    const result = await uploadWithholdingScan(owner, { bytes: await png(), fileName: "2307.png" }, testDb());
    expect(result.ok).toBe(true);
    const file = await readOrganizationFile(owner, result.ok ? result.fileId : "", testDb());
    expect(file?.contentType).toMatch(/^image\//);
  });

  it("refuses an empty file, an oversized one, and anything that is not a PDF or an image (even one named .pdf)", async () => {
    const owner = await actorFor();
    const send = (bytes: Uint8Array, fileName = "2307.pdf") => uploadWithholdingScan(owner, { bytes, fileName }, testDb());

    expect(await send(new Uint8Array(0))).toEqual({ ok: false, error: DOCUMENT_MESSAGES.empty });
    expect(await send(new Uint8Array(MAX_UPLOAD_BYTES + 1))).toEqual({ ok: false, error: DOCUMENT_MESSAGES.tooLarge });
    expect(await send(new TextEncoder().encode("just some text"))).toEqual({ ok: false, error: DOCUMENT_MESSAGES.wrongType });
    expect(await send(Uint8Array.from([0x4d, 0x5a, 0x90, 0x00, 0x03]), "2307.pdf")).toEqual({ ok: false, error: DOCUMENT_MESSAGES.wrongType });
  });

  it("is for people who can record payments, so a member cannot upload", async () => {
    const member = await actorFor("member");
    await expect(uploadWithholdingScan(member, { bytes: pdf(), fileName: "2307.pdf" }, testDb())).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("is invisible to another business", async () => {
    const owner = await actorFor();
    const result = await uploadWithholdingScan(owner, { bytes: pdf(), fileName: "2307.pdf" }, testDb());
    const stranger = await actorFor();
    expect(await readOrganizationFile(stranger, result.ok ? result.fileId : "", testDb())).toBeNull();
  });

  it("does not count toward the registration folder's limit", async () => {
    const owner = await actorFor();
    for (let i = 0; i < 8; i++) {
      const stored = await uploadRegistrationDocument(owner, { bytes: pdf(), kind: "cor", fileName: `cor-${i}.pdf` }, ["cor"], testDb());
      expect(stored.ok).toBe(true);
    }
    expect((await uploadWithholdingScan(owner, { bytes: pdf(), fileName: "2307.pdf" }, testDb())).ok).toBe(true);
  });

  it("writes no audit event of its own (the certificate's event covers it)", async () => {
    const owner = await actorFor();
    await uploadWithholdingScan(owner, { bytes: pdf(), fileName: "2307.pdf" }, testDb());
    expect(await listAllAuditEvents(testDb())).toEqual([]);
  });
});

describe("removeWithholdingScan", () => {
  it("removes a scan of this business and leaves everything else alone", async () => {
    const owner = await actorFor();
    const scan = await uploadWithholdingScan(owner, { bytes: pdf(), fileName: "2307.pdf" }, testDb());
    const document = await uploadRegistrationDocument(owner, { bytes: pdf(), kind: "cor", fileName: "cor.pdf" }, ["cor"], testDb());
    const scanId = scan.ok ? scan.fileId : "";
    const documentId = document.ok ? document.document.id : "";

    await removeWithholdingScan(testDb(), owner, documentId); // not a scan: untouched
    expect(await readOrganizationFile(owner, documentId, testDb())).not.toBeNull();

    const stranger = await actorFor();
    await removeWithholdingScan(testDb(), stranger, scanId); // another business: untouched
    expect(await readOrganizationFile(owner, scanId, testDb())).not.toBeNull();

    await removeWithholdingScan(testDb(), owner, scanId);
    expect(await readOrganizationFile(owner, scanId, testDb())).toBeNull();
  });
});
