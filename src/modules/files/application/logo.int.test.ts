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
import {
  getOrganizationLogo,
  readLogoFile,
  readLogoForSharedDocument,
  removeOrganizationLogo,
  uploadOrganizationLogo,
} from "./logo";

async function actorFor(role: Role = "owner", name = "Acme"): Promise<OrgActor> {
  const org = await createTestOrganization(testDb(), { name });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com` });
  return { organizationId: org.id, userId: user.id, role };
}

const image = (width: number, height: number, alpha = 1) =>
  sharp({ create: { width, height, channels: 4, background: { r: 80, g: 60, b: 180, alpha } } });

const transparentPng = () => image(1200, 400, 0.5).png().toBuffer();
const photoJpeg = () =>
  image(900, 900)
    .jpeg()
    .withExif({ IFD0: { Copyright: "Maria Santos", Artist: "Maria" } })
    .toBuffer();

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("uploadOrganizationLogo", () => {
  it("shrinks a transparent logo to fit 600px, keeps it PNG, and audits it", async () => {
    const actor = await actorFor();

    const result = await uploadOrganizationLogo(actor, await transparentPng(), testDb());

    expect(result).toMatchObject({ ok: true, logo: { width: 600, height: 200 } });
    const logo = await getOrganizationLogo(actor, testDb());
    expect(logo).toMatchObject({ width: 600, height: 200 });
    const file = await readLogoFile(actor, logo?.id ?? "", testDb());
    expect(file?.contentType).toBe("image/png");
    expect((await sharp(file?.data).metadata()).hasAlpha).toBe(true);
    expect(await listAllAuditEvents(testDb())).toEqual([
      expect.objectContaining({
        action: "organization.logo_updated",
        entityType: "organization",
        entityId: actor.organizationId,
        metadata: { fileId: logo?.id, contentType: "image/png", byteSize: file?.data.length },
      }),
    ]);
  });

  it("re-encodes an opaque image as JPEG without its metadata", async () => {
    const actor = await actorFor();

    await uploadOrganizationLogo(actor, await photoJpeg(), testDb());

    const logo = await getOrganizationLogo(actor, testDb());
    const file = await readLogoFile(actor, logo?.id ?? "", testDb());
    expect(file?.contentType).toBe("image/jpeg");
    const meta = await sharp(file?.data).metadata();
    expect(meta).toMatchObject({ width: 600, height: 600 });
    expect(meta.exif).toBeUndefined();
  });

  it("replaces the previous logo", async () => {
    const actor = await actorFor();
    await uploadOrganizationLogo(actor, await transparentPng(), testDb());
    const first = await getOrganizationLogo(actor, testDb());

    await uploadOrganizationLogo(actor, await photoJpeg(), testDb());

    const second = await getOrganizationLogo(actor, testDb());
    expect(second?.id).not.toBe(first?.id);
    expect(await readLogoFile(actor, first?.id ?? "", testDb())).toBeNull();
  });

  it.each([
    ["an SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
    ["a GIF", Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00;", "latin1")],
    ["a PDF", Buffer.from("%PDF-1.7\n")],
  ])("refuses %s", async (_label, bytes) => {
    const actor = await actorFor();

    expect(await uploadOrganizationLogo(actor, bytes, testDb())).toEqual({
      ok: false,
      error: "Upload a PNG, JPG or WebP image.",
    });
    expect(await getOrganizationLogo(actor, testDb())).toBeNull();
  });

  it("refuses an empty upload", async () => {
    const actor = await actorFor();

    expect(await uploadOrganizationLogo(actor, new Uint8Array(), testDb())).toEqual({
      ok: false,
      error: "Choose an image to upload.",
    });
  });

  it("refuses files over 2 MB before reading them", async () => {
    const actor = await actorFor();
    const huge = new Uint8Array(2 * 1024 * 1024 + 1);
    huge.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    expect(await uploadOrganizationLogo(actor, huge, testDb())).toEqual({
      ok: false,
      error: "That image is over 2 MB. Try a smaller one.",
    });
  });

  it("refuses a corrupt image that only looks like a PNG", async () => {
    const actor = await actorFor();
    const fake = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

    expect(await uploadOrganizationLogo(actor, fake, testDb())).toEqual({
      ok: false,
      error: "We couldn't read that image. Try saving it again as a PNG or JPG.",
    });
  });

  it("refuses members", async () => {
    const actor = await actorFor("member");

    await expect(uploadOrganizationLogo(actor, await transparentPng(), testDb())).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("removeOrganizationLogo", () => {
  it("deletes the logo and audits it", async () => {
    const actor = await actorFor();
    await uploadOrganizationLogo(actor, await transparentPng(), testDb());

    await removeOrganizationLogo(actor, testDb());

    expect(await getOrganizationLogo(actor, testDb())).toBeNull();
    expect((await listAllAuditEvents(testDb())).map((e) => e.action)).toEqual([
      "organization.logo_updated",
      "organization.logo_removed",
    ]);
  });
});

describe("readLogoFile", () => {
  it("never serves another organization's file", async () => {
    const owner = await actorFor("owner", "One");
    await uploadOrganizationLogo(owner, await transparentPng(), testDb());
    const logo = await getOrganizationLogo(owner, testDb());
    const intruder = await actorFor("owner", "Two");

    expect(await readLogoFile(intruder, logo?.id ?? "", testDb())).toBeNull();
    expect(await readLogoFile(intruder, "not-a-uuid", testDb())).toBeNull();
  });
});

describe("readLogoForSharedDocument", () => {
  it("returns the named organization's logo only", async () => {
    const owner = await actorFor("owner", "One");
    await uploadOrganizationLogo(owner, await transparentPng(), testDb());
    const other = await actorFor("owner", "Two");

    expect((await readLogoForSharedDocument(owner.organizationId, testDb()))?.contentType).toBe("image/png");
    expect(await readLogoForSharedDocument(other.organizationId, testDb())).toBeNull();
  });
});
