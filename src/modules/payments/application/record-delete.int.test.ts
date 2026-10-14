import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { files, payments, withholdingCertificateLines, withholdingCertificates } from "@/db/schema";
import { closeTestDb, listAllAuditEvents, resetTables, testDb } from "@/db/testing";
import { ForbiddenError, type OrgActor } from "@/modules/authz";
import { uploadWithholdingScan } from "@/modules/files";
import { listTrash } from "@/modules/trash";
import { deleteVoidedCertificate, recordCertificate, restoreDeletedCertificate, voidCertificate } from "./certificates";
import {
  FIXTURE_MARKET,
  FIXTURE_NOW,
  issuedStatement,
  rawCertificate,
  testBusiness,
  testCustomer,
  testMember,
  withheldPayment,
} from "./certificate-fixtures";
import { deleteVoidedPayment, restoreDeletedPayment, voidPayment } from "./payments";

// The owner deleting a voided payment or a voided 2307 into the recycle bin, and bringing it back
// (docs/superpowers/specs/2026-10-14-owner-delete-recycle-bin-design.md). Made-up data only.

const db = () => testDb();
const later = new Date(FIXTURE_NOW.getTime() + 24 * 60 * 60 * 1000);
const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF");

async function scene() {
  const actor = await testBusiness();
  const customerId = await testCustomer(actor);
  const invoiceId = await issuedStatement(actor, customerId);
  const paymentId = await withheldPayment(actor, invoiceId);
  return { actor, customerId, invoiceId, paymentId };
}

const voided = async (actor: OrgActor, paymentId: string) => {
  const result = await voidPayment(actor, paymentId, "Entered twice", db(), FIXTURE_NOW);
  if (!result.ok) throw new Error("void");
};
const paymentRow = async (id: string) => (await db().select().from(payments).where(eq(payments.id, id)))[0];
const certificateRow = async (id: string) => (await db().select().from(withholdingCertificates).where(eq(withholdingCertificates.id, id)))[0];
const eventsOf = async (action: string) => (await listAllAuditEvents(db())).filter((event) => event.action === action);
const bin = (actor: OrgActor) => listTrash(actor, db(), FIXTURE_NOW);

beforeEach(async () => {
  await resetTables();
});
afterAll(closeTestDb);

describe("deleting a voided payment", () => {
  it("moves it to the recycle bin under its receipt number and records who did it", async () => {
    const { actor, paymentId } = await scene();
    await voided(actor, paymentId);
    const receiptNumber = (await paymentRow(paymentId))?.receiptNumber;

    expect(await deleteVoidedPayment(actor, paymentId, db(), FIXTURE_NOW)).toEqual({ ok: true });

    expect(await paymentRow(paymentId)).toBeUndefined();
    expect(await bin(actor)).toEqual([
      expect.objectContaining({ kind: "payment", label: receiptNumber, customerName: "Juan Dela Cruz", totalMinor: 96_000, currency: "PHP" }),
    ]);
    expect(await eventsOf("payment.deleted")).toHaveLength(1);
  });

  it("won't delete a payment that still counts: void it first", async () => {
    const { actor, paymentId } = await scene();
    expect(await deleteVoidedPayment(actor, paymentId, db(), FIXTURE_NOW)).toMatchObject({ ok: false, error: expect.stringContaining("Void") });
    expect(await paymentRow(paymentId)).toBeDefined();
    expect(await bin(actor)).toEqual([]);
  });

  it("is for the owner only, and never reaches another business's payment", async () => {
    const { actor, paymentId } = await scene();
    await voided(actor, paymentId);
    for (const role of ["admin", "member"] as const) {
      await expect(deleteVoidedPayment(await testMember(actor, role), paymentId, db())).rejects.toBeInstanceOf(ForbiddenError);
    }
    const stranger = await testBusiness("owner", "Other Co");
    expect(await deleteVoidedPayment(stranger, paymentId, db())).toEqual({ ok: false, notFound: true });
    expect(await paymentRow(paymentId)).toBeDefined();
  });

  it("restores it exactly as it was, still void, with the bill unchanged", async () => {
    const { actor, paymentId, invoiceId } = await scene();
    await voided(actor, paymentId);
    const before = await paymentRow(paymentId);
    await deleteVoidedPayment(actor, paymentId, db(), FIXTURE_NOW);
    const [item] = await bin(actor);

    const restored = await restoreDeletedPayment(actor, item?.id ?? "", db(), later);

    expect(restored).toEqual({ ok: true, paymentId });
    expect(await paymentRow(paymentId)).toEqual(before);
    expect(await bin(actor)).toEqual([]);
    expect(await eventsOf("payment.restored")).toHaveLength(1);
    expect(invoiceId).toBeDefined();
  });

  it("won't restore for anyone but the owner, or twice", async () => {
    const { actor, paymentId } = await scene();
    await voided(actor, paymentId);
    await deleteVoidedPayment(actor, paymentId, db(), FIXTURE_NOW);
    const [item] = await bin(actor);
    await expect(restoreDeletedPayment(await testMember(actor, "admin"), item?.id ?? "", db())).rejects.toBeInstanceOf(ForbiddenError);
    expect(await restoreDeletedPayment(actor, item?.id ?? "", db(), later)).toMatchObject({ ok: true });
    expect(await restoreDeletedPayment(actor, item?.id ?? "", db(), later)).toEqual({ ok: false, notFound: true });
  });
});

describe("deleting a voided 2307", () => {
  async function certificateScene(withScan = false) {
    const s = await scene();
    let fileId: string | undefined;
    if (withScan) {
      const stored = await uploadWithholdingScan(s.actor, { bytes: PDF, fileName: "2307.pdf" }, db());
      if (!stored.ok) throw new Error("scan");
      fileId = stored.fileId;
    }
    const recorded = await recordCertificate(s.actor, rawCertificate(s.customerId, [s.paymentId]), { market: FIXTURE_MARKET, fileId, now: FIXTURE_NOW }, db());
    if (!recorded.ok || !("id" in recorded)) throw new Error("certificate");
    return { ...s, certificateId: recorded.id, fileId };
  }
  const voidIt = async (actor: OrgActor, id: string) => {
    const result = await voidCertificate(actor, id, "Recorded twice", db(), FIXTURE_NOW);
    if (!result.ok) throw new Error("void certificate");
  };
  const fileExists = async (id: string) => (await db().select({ id: files.id }).from(files).where(eq(files.id, id))).length === 1;

  it("moves it, its rows and its scan to the recycle bin and out of the books", async () => {
    const { actor, certificateId, fileId } = await certificateScene(true);
    await voidIt(actor, certificateId);

    expect(await deleteVoidedCertificate(actor, certificateId, db(), FIXTURE_NOW)).toEqual({ ok: true });

    expect(await certificateRow(certificateId)).toBeUndefined();
    expect(await db().select().from(withholdingCertificateLines).where(eq(withholdingCertificateLines.certificateId, certificateId))).toEqual([]);
    expect(await fileExists(fileId ?? "")).toBe(false);
    expect(await bin(actor)).toEqual([
      expect.objectContaining({ kind: "certificate", label: "Dela Cruz Trading, Q3 2026", customerName: "Juan Dela Cruz", totalMinor: 6_000, currency: "PHP" }),
    ]);
    expect(await eventsOf("withholding_certificate.deleted")).toHaveLength(1);
  });

  it("won't delete a certificate that is in force: void it first", async () => {
    const { actor, certificateId } = await certificateScene();
    expect(await deleteVoidedCertificate(actor, certificateId, db(), FIXTURE_NOW)).toMatchObject({ ok: false, error: expect.stringContaining("Void") });
    expect(await certificateRow(certificateId)).toBeDefined();
  });

  it("is for the owner only", async () => {
    const { actor, certificateId } = await certificateScene();
    await voidIt(actor, certificateId);
    await expect(deleteVoidedCertificate(await testMember(actor, "admin"), certificateId, db())).rejects.toBeInstanceOf(ForbiddenError);
    expect(await deleteVoidedCertificate(await testBusiness("owner", "Other Co"), certificateId, db())).toEqual({ ok: false, notFound: true });
  });

  it("restores the form and its rows, still void, without links or scan", async () => {
    const { actor, certificateId } = await certificateScene(true);
    await voidIt(actor, certificateId);
    const before = await certificateRow(certificateId);
    await deleteVoidedCertificate(actor, certificateId, db(), FIXTURE_NOW);
    const [item] = await bin(actor);

    expect(await restoreDeletedCertificate(actor, item?.id ?? "", db(), later)).toEqual({ ok: true, certificateId });

    expect(await certificateRow(certificateId)).toEqual({ ...before, fileId: null });
    const lines = await db().select().from(withholdingCertificateLines).where(eq(withholdingCertificateLines.certificateId, certificateId));
    expect(lines).toEqual([expect.objectContaining({ atcCode: "WI160", rateBps: 200, totalMinor: 300_000, taxWithheldMinor: 6_000, position: 1 })]);
    expect(await bin(actor)).toEqual([]);
    expect(await eventsOf("withholding_certificate.restored")).toHaveLength(1);
  });
});
