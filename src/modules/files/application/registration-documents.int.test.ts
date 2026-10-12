import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  closeTestDb,
  createTestOrganization,
  createTestUser,
  listAllAuditEvents,
  resetTables,
  testDb,
} from "@/db/testing";
import { ForbiddenError, type OrgActor, type Role } from "@/modules/authz";
import { uploadOrganizationLogo } from "./logo";
import {
  listRegistrationDocuments,
  readOrganizationFile,
  removeRegistrationDocument,
  uploadRegistrationDocument,
} from "./registration-documents";

const KINDS = ["cor", "name_registration", "permit", "other"];

async function actorFor(role: Role = "owner"): Promise<OrgActor> {
  const org = await createTestOrganization();
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com` });
  return { organizationId: org.id, userId: user.id, role };
}

const pdf = () => new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF");
const photo = (width = 3000, height = 4000) =>
  sharp({ create: { width, height, channels: 3, background: { r: 240, g: 240, b: 235 } } })
    .jpeg()
    .withExif({ IFD0: { Copyright: "Eunice", Artist: "Eunice" } })
    .toBuffer();

beforeEach(async () => {
  await resetTables();
});
afterAll(async () => {
  await closeTestDb();
});

describe("the registration certificate folder", () => {
  it("keeps a PDF as it came and lists it", async () => {
    const actor = await actorFor();
    const bytes = pdf();

    const result = await uploadRegistrationDocument(actor, { bytes, kind: "cor", fileName: "C:\\scans\\COR 2303.pdf" }, KINDS, testDb());

    expect(result).toMatchObject({ ok: true, document: { kind: "cor", fileName: "COR 2303.pdf", contentType: "application/pdf", byteSize: bytes.byteLength } });
    expect(await listRegistrationDocuments(actor, testDb())).toHaveLength(1);
    const events = await listAllAuditEvents(testDb());
    expect(events).toEqual([expect.objectContaining({ action: "organization.document_uploaded" })]);
    expect(JSON.stringify(events[0]?.metadata)).not.toContain("COR 2303");
  });

  it("shrinks a phone photo, drops its metadata, and stores a JPEG", async () => {
    const actor = await actorFor();
    const result = await uploadRegistrationDocument(actor, { bytes: await photo(), kind: "name_registration", fileName: "dti.jpg" }, KINDS, testDb());
    expect(result.ok).toBe(true);
    const id = result.ok ? result.document.id : "";
    const file = await readOrganizationFile(actor, id, testDb());
    const meta = await sharp(file?.data).metadata();
    expect(file?.contentType).toBe("image/jpeg");
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(2000);
    expect(meta.exif).toBeUndefined();
  });

  it("refuses files that aren't a PDF or an image, empty files, unknown kinds and oversized files", async () => {
    const actor = await actorFor();
    const send = (bytes: Uint8Array, kind = "cor") => uploadRegistrationDocument(actor, { bytes, kind, fileName: "x" }, KINDS, testDb());
    expect(await send(new TextEncoder().encode("<svg onload=alert(1)/>"))).toMatchObject({ ok: false, error: expect.stringContaining("PDF") });
    expect(await send(new Uint8Array())).toMatchObject({ ok: false });
    expect(await send(pdf(), "diary")).toMatchObject({ ok: false, error: expect.stringContaining("kind") });
    expect(await send(new Uint8Array(2 * 1024 * 1024 + 1).fill(0x25))).toMatchObject({ ok: false, error: expect.stringContaining("2 MB") });
    expect(await send(Uint8Array.from([0xff, 0xd8, 0xff, 0x00, 0x01]))).toMatchObject({ ok: false });
    expect(await listRegistrationDocuments(actor, testDb())).toHaveLength(0);
  });

  it("keeps at most eight", async () => {
    const actor = await actorFor();
    for (let i = 0; i < 8; i++) {
      expect((await uploadRegistrationDocument(actor, { bytes: pdf(), kind: "other", fileName: `d${i}.pdf` }, KINDS, testDb())).ok).toBe(true);
    }
    expect(await uploadRegistrationDocument(actor, { bytes: pdf(), kind: "other", fileName: "9.pdf" }, KINDS, testDb())).toMatchObject({ ok: false, error: expect.stringContaining("8") });
  });

  it("removes a document and audits it", async () => {
    const actor = await actorFor();
    const up = await uploadRegistrationDocument(actor, { bytes: pdf(), kind: "cor", fileName: "a.pdf" }, KINDS, testDb());
    const id = up.ok ? up.document.id : "";
    expect(await removeRegistrationDocument(actor, id, testDb())).toBe(true);
    expect(await removeRegistrationDocument(actor, id, testDb())).toBe(false);
    expect(await removeRegistrationDocument(actor, "not-a-uuid", testDb())).toBe(false);
    expect((await listAllAuditEvents(testDb())).map((e) => e.action)).toEqual([
      "organization.document_uploaded",
      "organization.document_removed",
    ]);
  });

  it("is for owners and admins only, and never shows another business's file", async () => {
    const owner = await actorFor();
    const other = await actorFor();
    const up = await uploadRegistrationDocument(owner, { bytes: pdf(), kind: "cor", fileName: "a.pdf" }, KINDS, testDb());
    const id = up.ok ? up.document.id : "";

    const member: OrgActor = { ...owner, role: "member" };
    await expect(listRegistrationDocuments(member, testDb())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(uploadRegistrationDocument(member, { bytes: pdf(), kind: "cor", fileName: "b.pdf" }, KINDS, testDb())).rejects.toBeInstanceOf(ForbiddenError);
    expect(await readOrganizationFile(member, id, testDb())).toBeNull();
    expect(await readOrganizationFile(other, id, testDb())).toBeNull();
    expect(await readOrganizationFile({ ...owner, role: "admin" }, id, testDb())).not.toBeNull();
  });

  it("serves the logo to any member, and the logo upload still works beside documents", async () => {
    const owner = await actorFor();
    const logo = await sharp({ create: { width: 200, height: 100, channels: 3, background: "#4338ca" } }).png().toBuffer();
    const result = await uploadOrganizationLogo(owner, logo, testDb());
    const id = result.ok ? result.logo.id : "";
    await uploadRegistrationDocument(owner, { bytes: pdf(), kind: "cor", fileName: "a.pdf" }, KINDS, testDb());
    expect(await readOrganizationFile({ ...owner, role: "member" }, id, testDb())).toMatchObject({ purpose: "logo" });
    expect(await listRegistrationDocuments(owner, testDb())).toHaveLength(1);
  });
});
