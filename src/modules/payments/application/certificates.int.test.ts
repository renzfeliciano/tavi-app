import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { MarketProfile } from "@/config/markets";
import { files, withholdingCertificateLines, withholdingCertificatePayments, withholdingCertificates } from "@/db/schema";
import { closeTestDb, listAllAuditEvents, resetTables, testDb } from "@/db/testing";
import { ForbiddenError, type OrgActor } from "@/modules/authz";
import { uploadWithholdingScan } from "@/modules/files";
import { LINK_MESSAGES } from "../domain/withholding";
import { recordCertificate, updateCertificate, voidCertificate } from "./certificates";
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
import { voidPayment } from "./payments";

// Made-up data only. These run on the test branch (docs/superpowers/specs/2026-10-13-withholding-certificates-design.md).

const db = () => testDb();
const options = { market: FIXTURE_MARKET, now: FIXTURE_NOW };
const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF");

/** A business with one customer, one issued billing statement and two payments with tax withheld. */
async function scene() {
  const actor = await testBusiness();
  const customerId = await testCustomer(actor);
  const invoiceId = await issuedStatement(actor, customerId);
  const a = await withheldPayment(actor, invoiceId);
  const b = await withheldPayment(actor, invoiceId);
  return { actor, customerId, invoiceId, a, b };
}

const certificateRow = async (id: string) => (await db().select().from(withholdingCertificates).where(eq(withholdingCertificates.id, id)))[0];
const linksOf = (certificateId: string) =>
  db().select().from(withholdingCertificatePayments).where(eq(withholdingCertificatePayments.certificateId, certificateId));
const linesOf = (certificateId: string) =>
  db().select().from(withholdingCertificateLines).where(eq(withholdingCertificateLines.certificateId, certificateId)).orderBy(withholdingCertificateLines.position);
const allCertificates = () => db().select({ id: withholdingCertificates.id }).from(withholdingCertificates);
const eventsOf = async (action: string) => (await listAllAuditEvents(db())).filter((event) => event.action === action);
const scan = async (actor: OrgActor) => {
  const stored = await uploadWithholdingScan(actor, { bytes: PDF, fileName: "2307.pdf" }, db());
  if (!stored.ok) throw new Error("scan");
  return stored.fileId;
};
const fileExists = async (id: string) => (await db().select({ id: files.id }).from(files).where(eq(files.id, id))).length === 1;
const ok = (result: { ok: boolean }): string => {
  if (!result.ok || !("id" in result)) throw new Error(`expected ok, got ${JSON.stringify(result)}`);
  return (result as { id: string }).id;
};

beforeEach(async () => {
  await resetTables();
});
afterAll(async () => {
  await closeTestDb();
});

describe("recordCertificate", () => {
  it("saves the header, the rows and the links, and writes one audit event that never holds the TIN or the name", async () => {
    const { actor, customerId, a, b } = await scene();

    const result = await recordCertificate(actor, rawCertificate(customerId, [a, b]), options, db());

    const id = ok(result);
    expect(await certificateRow(id)).toMatchObject({
      organizationId: actor.organizationId,
      customerId,
      payorTin: "987-654-321-000",
      payorName: "Dela Cruz Trading",
      periodFrom: "2026-07-01",
      periodTo: "2026-09-30",
      receivedOn: "2026-10-01",
      currency: "PHP",
      fileId: null,
      voidedAt: null,
    });
    expect(await linesOf(id)).toMatchObject([
      { position: 1, atcCode: "WI160", rateBps: 200, month1Minor: 0, month2Minor: 300_000, month3Minor: 0, totalMinor: 300_000, taxWithheldMinor: 6_000 },
    ]);
    expect((await linksOf(id)).map((link) => link.paymentId).sort()).toEqual([a, b].sort());

    const events = await eventsOf("withholding_certificate.recorded");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ entityType: "withholding_certificate", entityId: id, actorId: actor.userId });
    expect(events[0]?.metadata).toMatchObject({ lineCount: 1, linkedCount: 2, taxWithheldMinor: 6_000, hasScan: false });
    expect(JSON.stringify(events[0]?.metadata)).not.toMatch(/987-654-321|Dela Cruz Trading/);
  });

  it("saves a certificate with no payments linked yet", async () => {
    const { actor, customerId } = await scene();
    const id = ok(await recordCertificate(actor, rawCertificate(customerId, []), options, db()));
    expect(await linksOf(id)).toEqual([]);
  });

  it("returns the form's own errors and saves nothing", async () => {
    const { actor, customerId, a } = await scene();
    const result = await recordCertificate(actor, rawCertificate(customerId, [a], { payorTin: "12" }), options, db());
    expect(result).toMatchObject({ ok: false, errors: { payorTin: expect.any(String) } });
    expect(await allCertificates()).toEqual([]);
  });

  it("refuses a customer from another business", async () => {
    const { actor } = await scene();
    const stranger = await testBusiness("owner", "Other Co");
    const foreignCustomer = await testCustomer(stranger, "Someone Else");
    const result = await recordCertificate(actor, rawCertificate(foreignCustomer, []), options, db());
    expect(result).toMatchObject({ ok: false, errors: { customerId: expect.any(String) } });
    expect(await allCertificates()).toEqual([]);
  });

  describe("which payments can go on it", () => {
    const rules: [string, string, () => Promise<{ actor: OrgActor; customerId: string; paymentId: string; market?: MarketProfile }>][] = [
      [
        "another customer's",
        LINK_MESSAGES.otherCustomer,
        async () => {
          const s = await scene();
          const other = await testCustomer(s.actor, "Other Buyer", "555-666-777-000");
          const paymentId = await withheldPayment(s.actor, await issuedStatement(s.actor, other));
          return { actor: s.actor, customerId: s.customerId, paymentId };
        },
      ],
      [
        "a voided",
        LINK_MESSAGES.voided,
        async () => {
          const s = await scene();
          const voided = await voidPayment(s.actor, s.a, "Entered twice", db(), FIXTURE_NOW);
          if (!voided.ok) throw new Error("void");
          return { actor: s.actor, customerId: s.customerId, paymentId: s.a };
        },
      ],
      [
        "one with no tax withheld",
        LINK_MESSAGES.noWithheld,
        async () => {
          const s = await scene();
          const paymentId = await withheldPayment(s.actor, s.invoiceId, { withheld: "" });
          return { actor: s.actor, customerId: s.customerId, paymentId };
        },
      ],
      [
        "one in another currency",
        LINK_MESSAGES.currency,
        async () => {
          const s = await scene();
          return { actor: s.actor, customerId: s.customerId, paymentId: s.a, market: { ...FIXTURE_MARKET, currency: "USD" } };
        },
      ],
      [
        "one dated outside the quarter",
        LINK_MESSAGES.outsidePeriod,
        async () => {
          const s = await scene();
          const paymentId = await withheldPayment(s.actor, s.invoiceId, { paidOn: "2026-10-01" });
          return { actor: s.actor, customerId: s.customerId, paymentId };
        },
      ],
      [
        "one already on another certificate",
        LINK_MESSAGES.alreadyLinked,
        async () => {
          const s = await scene();
          ok(await recordCertificate(s.actor, rawCertificate(s.customerId, [s.a]), options, db()));
          return { actor: s.actor, customerId: s.customerId, paymentId: s.a };
        },
      ],
    ];

    it.each(rules)("refuses %s payment", async (_name, message, arrange) => {
      const { actor, customerId, paymentId, market } = await arrange();
      const before = (await allCertificates()).length;

      const result = await recordCertificate(actor, rawCertificate(customerId, [paymentId]), { ...options, market: market ?? options.market }, db());

      expect(result).toEqual({ ok: false, errors: { paymentIds: message } });
      expect(await allCertificates()).toHaveLength(before);
    });

    it("refuses a payment id that isn't this business's", async () => {
      const s = await scene();
      const stranger = await scene();
      const result = await recordCertificate(s.actor, rawCertificate(s.customerId, [stranger.a]), options, db());
      expect(result).toEqual({ ok: false, errors: { paymentIds: LINK_MESSAGES.notFound } });
    });

    it("takes a payment dated on the quarter's first day and on its last", async () => {
      const s = await scene();
      const first = await withheldPayment(s.actor, s.invoiceId, { paidOn: "2026-07-01" });
      const last = await withheldPayment(s.actor, s.invoiceId, { paidOn: "2026-09-30" });
      const id = ok(await recordCertificate(s.actor, rawCertificate(s.customerId, [first, last]), options, db()));
      expect(await linksOf(id)).toHaveLength(2);
    });

    it("lets exactly one of two simultaneous certificates take the same payments", async () => {
      const { actor, customerId, a, b } = await scene();

      const results = await Promise.all([
        recordCertificate(actor, rawCertificate(customerId, [a, b]), options, db()),
        recordCertificate(actor, rawCertificate(customerId, [b, a]), options, db()),
      ]);

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, errors: { paymentIds: LINK_MESSAGES.alreadyLinked } }]);
      expect(await allCertificates()).toHaveLength(1);
    });
  });

  it("keeps a scan of its own and refuses someone else's", async () => {
    const { actor, customerId } = await scene();
    const fileId = await scan(actor);
    const id = ok(await recordCertificate(actor, rawCertificate(customerId, []), { ...options, fileId }, db()));
    expect((await certificateRow(id))?.fileId).toBe(fileId);
    expect((await eventsOf("withholding_certificate.recorded"))[0]?.metadata).toMatchObject({ hasScan: true });

    const stranger = await testBusiness("owner", "Other Co");
    const foreignScan = await scan(stranger);
    const refused = await recordCertificate(actor, rawCertificate(customerId, []), { ...options, fileId: foreignScan }, db());
    expect(refused.ok).toBe(false);
    expect(await allCertificates()).toHaveLength(1);
  });

  it("is for people who can record payments: a member is refused", async () => {
    const { actor, customerId } = await scene();
    const member = await testMember(actor, "member");
    await expect(recordCertificate(member, rawCertificate(customerId, []), options, db())).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("updateCertificate", () => {
  it("replaces the rows and the links and records the counts before and after", async () => {
    const { actor, customerId, a, b } = await scene();
    const id = ok(await recordCertificate(actor, rawCertificate(customerId, [a, b]), options, db()));

    const raw = rawCertificate(customerId, [b], {
      lines: [
        { atcCode: "WI160", description: "Services", rate: "2", month1: "1,500", month2: "", month3: "", taxWithheld: "30" },
        { atcCode: "WC158", description: "Goods", rate: "1", month1: "", month2: "", month3: "500", taxWithheld: "5" },
      ],
    });
    const result = await updateCertificate(actor, id, raw, options, db());

    expect(ok(result)).toBe(id);
    expect((await linesOf(id)).map((line) => [line.position, line.atcCode, line.taxWithheldMinor])).toEqual([
      [1, "WI160", 3_000],
      [2, "WC158", 500],
    ]);
    expect((await linksOf(id)).map((link) => link.paymentId)).toEqual([b]);
    const [event] = await eventsOf("withholding_certificate.updated");
    expect(event?.metadata).toMatchObject({ linesBefore: 1, linesAfter: 2, linkedBefore: 2, linkedAfter: 1 });
    expect(JSON.stringify(event?.metadata)).not.toMatch(/987-654-321/);
  });

  it("lets a certificate keep its own payments but not take another certificate's", async () => {
    const { actor, customerId, a, b } = await scene();
    const first = ok(await recordCertificate(actor, rawCertificate(customerId, [a]), options, db()));
    const second = ok(await recordCertificate(actor, rawCertificate(customerId, [b]), options, db()));

    expect(ok(await updateCertificate(actor, first, rawCertificate(customerId, [a], { notes: "Same payment" }), options, db()))).toBe(first);
    expect(await updateCertificate(actor, second, rawCertificate(customerId, [a, b]), options, db())).toEqual({
      ok: false,
      errors: { paymentIds: LINK_MESSAGES.alreadyLinked },
    });
    expect((await linksOf(second)).map((link) => link.paymentId)).toEqual([b]);
  });

  it("keeps the scan when none is given, removes it on null, and replaces it (deleting the old file) on a new id", async () => {
    const { actor, customerId } = await scene();
    const first = await scan(actor);
    const id = ok(await recordCertificate(actor, rawCertificate(customerId, []), { ...options, fileId: first }, db()));

    ok(await updateCertificate(actor, id, rawCertificate(customerId, [], { notes: "Edited" }), options, db()));
    expect((await certificateRow(id))?.fileId).toBe(first);

    const second = await scan(actor);
    ok(await updateCertificate(actor, id, rawCertificate(customerId, []), { ...options, fileId: second }, db()));
    expect((await certificateRow(id))?.fileId).toBe(second);
    expect(await fileExists(first)).toBe(false);

    ok(await updateCertificate(actor, id, rawCertificate(customerId, []), { ...options, fileId: null }, db()));
    expect((await certificateRow(id))?.fileId).toBeNull();
    expect(await fileExists(second)).toBe(false);
  });

  it("never changes whose certificate it is", async () => {
    const { actor, customerId } = await scene();
    const other = await testCustomer(actor, "Other Buyer", "555-666-777-000");
    const id = ok(await recordCertificate(actor, rawCertificate(customerId, []), options, db()));
    ok(await updateCertificate(actor, id, rawCertificate(other, []), options, db()));
    expect((await certificateRow(id))?.customerId).toBe(customerId);
  });

  it("refuses a voided certificate, and one from another business", async () => {
    const { actor, customerId } = await scene();
    const id = ok(await recordCertificate(actor, rawCertificate(customerId, []), options, db()));
    expect((await voidCertificate(actor, id, "Wrong customer", db(), FIXTURE_NOW)).ok).toBe(true);
    expect(await updateCertificate(actor, id, rawCertificate(customerId, []), options, db())).toMatchObject({ ok: false, error: expect.any(String) });

    const stranger = await testBusiness("owner", "Other Co");
    expect(await updateCertificate(stranger, id, rawCertificate(customerId, []), options, db())).toEqual({ ok: false, notFound: true });
    expect(await updateCertificate(actor, "not-a-uuid", rawCertificate(customerId, []), options, db())).toEqual({ ok: false, notFound: true });
  });

  it("is refused for a member", async () => {
    const { actor, customerId } = await scene();
    const id = ok(await recordCertificate(actor, rawCertificate(customerId, []), options, db()));
    const member = await testMember(actor, "member");
    await expect(updateCertificate(member, id, rawCertificate(customerId, []), options, db())).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("voidCertificate", () => {
  it("sets the void columns, frees its payments, and audits their ids", async () => {
    const { actor, customerId, a, b } = await scene();
    const id = ok(await recordCertificate(actor, rawCertificate(customerId, [a, b]), options, db()));

    expect(await voidCertificate(actor, id, "  Wrong form  ", db(), FIXTURE_NOW)).toEqual({ ok: true });

    expect(await certificateRow(id)).toMatchObject({ voidReason: "Wrong form", voidedBy: actor.userId });
    expect((await certificateRow(id))?.voidedAt).not.toBeNull();
    expect(await linksOf(id)).toEqual([]);
    const [event] = await eventsOf("withholding_certificate.voided");
    expect(event?.metadata).toMatchObject({ reason: "Wrong form" });
    expect((event?.metadata as { unlinkedPaymentIds: string[] }).unlinkedPaymentIds.sort()).toEqual([a, b].sort());

    // Freed: the same payments can go on a new certificate.
    expect(ok(await recordCertificate(actor, rawCertificate(customerId, [a, b]), options, db()))).not.toBe(id);
  });

  it("needs a reason of at most 500 characters, and can't be done twice", async () => {
    const { actor, customerId } = await scene();
    const id = ok(await recordCertificate(actor, rawCertificate(customerId, []), options, db()));
    expect(await voidCertificate(actor, id, "   ", db(), FIXTURE_NOW)).toMatchObject({ ok: false, errors: { reason: expect.any(String) } });
    expect(await voidCertificate(actor, id, "x".repeat(501), db(), FIXTURE_NOW)).toMatchObject({ ok: false, errors: { reason: expect.any(String) } });
    expect((await certificateRow(id))?.voidedAt).toBeNull();

    expect((await voidCertificate(actor, id, "Duplicate", db(), FIXTURE_NOW)).ok).toBe(true);
    expect(await voidCertificate(actor, id, "Again", db(), FIXTURE_NOW)).toMatchObject({ ok: false, error: expect.any(String) });
    expect(await eventsOf("withholding_certificate.voided")).toHaveLength(1);
  });

  it("is refused for a member, and unseen from another business", async () => {
    const { actor, customerId } = await scene();
    const id = ok(await recordCertificate(actor, rawCertificate(customerId, []), options, db()));
    const member = await testMember(actor, "member");
    await expect(voidCertificate(member, id, "Nope", db(), FIXTURE_NOW)).rejects.toBeInstanceOf(ForbiddenError);
    const stranger = await testBusiness("owner", "Other Co");
    expect(await voidCertificate(stranger, id, "Nope", db(), FIXTURE_NOW)).toEqual({ ok: false, notFound: true });
  });
});

describe("voiding a payment that is on a certificate", () => {
  it("removes its link, leaves the certificate and its other payment, and writes payment_unlinked", async () => {
    const { actor, customerId, a, b } = await scene();
    const id = ok(await recordCertificate(actor, rawCertificate(customerId, [a, b]), options, db()));

    const result = await voidPayment(actor, a, "Bounced", db(), FIXTURE_NOW);

    expect(result.ok).toBe(true);
    expect((await linksOf(id)).map((link) => link.paymentId)).toEqual([b]);
    expect((await certificateRow(id))?.voidedAt).toBeNull();
    const [event] = await eventsOf("withholding_certificate.payment_unlinked");
    expect(event).toMatchObject({ entityType: "withholding_certificate", entityId: id });
    expect(event?.metadata).toMatchObject({ certificateId: id, paymentId: a });
  });

  it("writes nothing extra when the payment was on no certificate", async () => {
    const { actor, a } = await scene();
    await voidPayment(actor, a, "Bounced", db(), FIXTURE_NOW);
    expect(await eventsOf("withholding_certificate.payment_unlinked")).toEqual([]);
  });
});
