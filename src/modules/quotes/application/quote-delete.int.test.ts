import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import { quoteLines, quotes } from "@/db/schema";
import { closeTestDb, createTestOrganization, createTestUser, listAllAuditEvents, resetTables, testDb } from "@/db/testing";
import { ForbiddenError, type OrgActor, type Role } from "@/modules/authz";
import { createCustomer } from "@/modules/customers";
import { blankLine } from "@/modules/documents";
import { listTrash } from "@/modules/trash";
import { saveQuoteDraft } from "./quotes";
import { cancelQuote, createQuoteLink, getSharedQuote, sendQuote } from "./sending";
import { deleteQuoteRecord, restoreDeletedSentQuote } from "./trash";

// The owner deleting a quotation that was sent, into the recycle bin, and bringing it back
// (docs/superpowers/specs/2026-10-14-owner-delete-recycle-bin-design.md). Made-up data only.

const NOW = new Date("2026-10-01T02:00:00Z");
const later = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
const db = () => testDb();

async function actorFor(role: Role = "owner"): Promise<OrgActor> {
  const org = await createTestOrganization(db(), { name: "Santos Aircon", email: "billing@santos.example" });
  const user = await createTestUser(db(), { email: `${crypto.randomUUID()}@example.com` });
  return { organizationId: org.id, userId: user.id, role };
}

async function sentQuote(actor: OrgActor) {
  const customer = await createCustomer(actor, { displayName: "Juan Dela Cruz", email: "juan@example.com", city: "Pasig" }, db());
  if (!customer.ok) throw new Error("customer");
  const saved = await saveQuoteDraft(
    actor,
    null,
    {
      customerId: customer.customer.id,
      currency: "PHP",
      issueDate: "2026-10-01",
      validUntil: "2026-10-15",
      notes: "Thank you",
      terms: "50% down",
      lines: [
        { ...blankLine(), description: "Aircon cleaning", quantity: "2", unitLabel: "unit", unitPrice: "1,500" },
        { ...blankLine(), description: "Freon refill", quantity: "1", unitLabel: "unit", unitPrice: "800" },
      ],
    },
    { locale: "en-PH" },
    db(),
  );
  if (!saved.ok) throw new Error("draft");
  const sent = await sendQuote(
    actor,
    saved.quote.id,
    { sender: { emailVerified: true }, market: MARKETS.PH, appUrl: "https://tavi.example", email: null, now: NOW },
    db(),
  );
  if (!sent.ok) throw new Error("send");
  return { id: saved.quote.id, number: sent.number, token: sent.url.split("/q/")[1] ?? "" };
}

const header = async (id: string) => (await db().select().from(quotes).where(eq(quotes.id, id)))[0];
/** The lines as the person sees them: a restored line is a new row, so its own id and timestamps are left out. */
const linesOf = async (id: string) =>
  (await db().select().from(quoteLines).where(eq(quoteLines.quoteId, id)).orderBy(quoteLines.position)).map((row) => {
    const line: Record<string, unknown> = { ...row };
    for (const key of ["id", "createdAt", "updatedAt"]) delete line[key];
    return line;
  });
const eventsOf = async (action: string) => (await listAllAuditEvents(db())).filter((event) => event.action === action);
const bin = (actor: OrgActor) => listTrash(actor, db(), NOW);

beforeEach(async () => {
  await resetTables();
});
afterAll(closeTestDb);

describe("deleteQuoteRecord", () => {
  it("moves a sent quotation to the recycle bin under its number and closes the customer's link", async () => {
    const actor = await actorFor();
    const quote = await sentQuote(actor);

    expect(await deleteQuoteRecord(actor, quote.id, db(), NOW)).toEqual({ ok: true });

    expect(await header(quote.id)).toBeUndefined();
    expect(await linesOf(quote.id)).toEqual([]);
    expect(await getSharedQuote(quote.token, db())).toBeNull();
    expect(await bin(actor)).toEqual([
      expect.objectContaining({ kind: "sent_quote", label: quote.number, customerName: "Juan Dela Cruz", totalMinor: 380_000, currency: "PHP" }),
    ]);
    expect(await eventsOf("quote.deleted")).toEqual([expect.objectContaining({ entityId: quote.id, metadata: expect.objectContaining({ number: quote.number, status: "SENT" }) })]);
  });

  it("takes quotations in any status: cancelled, approved, rejected, expired", async () => {
    const actor = await actorFor();
    const cancelled = await sentQuote(actor);
    await cancelQuote(actor, cancelled.id, "Customer changed their mind", db());
    expect(await deleteQuoteRecord(actor, cancelled.id, db(), NOW)).toEqual({ ok: true });

    for (const status of ["APPROVED", "REJECTED", "EXPIRED"] as const) {
      const quote = await sentQuote(actor);
      await db().update(quotes).set({ status, decidedAt: NOW }).where(eq(quotes.id, quote.id));
      expect(await deleteQuoteRecord(actor, quote.id, db(), NOW)).toEqual({ ok: true });
    }
    expect(await bin(actor)).toHaveLength(4);
  });

  it("keeps a quotation that became a billing statement: cancel the statement instead", async () => {
    const actor = await actorFor();
    const quote = await sentQuote(actor);
    await db().update(quotes).set({ status: "APPROVED", convertedInvoiceId: crypto.randomUUID(), convertedAt: NOW }).where(eq(quotes.id, quote.id));

    expect(await deleteQuoteRecord(actor, quote.id, db(), NOW)).toMatchObject({ ok: false, error: expect.stringContaining("stays on record") });
    expect(await header(quote.id)).toBeDefined();
    expect(await bin(actor)).toEqual([]);
  });

  it("leaves a draft that was never sent to the usual draft delete", async () => {
    const actor = await actorFor();
    const customer = await createCustomer(actor, { displayName: "Juan Dela Cruz" }, db());
    if (!customer.ok) throw new Error("customer");
    const saved = await saveQuoteDraft(
      actor,
      null,
      { customerId: customer.customer.id, currency: "PHP", issueDate: "2026-10-01", validUntil: "2026-10-15", notes: "", terms: "", lines: [{ ...blankLine(), description: "Job", quantity: "1", unitLabel: "unit", unitPrice: "100" }] },
      { locale: "en-PH" },
      db(),
    );
    if (!saved.ok) throw new Error("draft");
    expect(await deleteQuoteRecord(actor, saved.quote.id, db(), NOW)).toMatchObject({ ok: false, error: expect.any(String) });
  });

  it("is for the owner only, and never reaches another business's quotation", async () => {
    const actor = await actorFor();
    const quote = await sentQuote(actor);
    for (const role of ["admin", "member"] as const) {
      await expect(deleteQuoteRecord({ ...actor, role }, quote.id, db())).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await deleteQuoteRecord(await actorFor(), quote.id, db())).toEqual({ ok: false, notFound: true });
    expect(await header(quote.id)).toBeDefined();
  });
});

describe("restoreDeletedSentQuote", () => {
  it("brings the quotation back exactly as it was, with the same number, status, snapshots and lines", async () => {
    const actor = await actorFor();
    const quote = await sentQuote(actor);
    await db().update(quotes).set({ status: "APPROVED", viewedAt: NOW, decidedAt: NOW, decisionName: "Juan D.", decisionIp: "203.0.113.5" }).where(eq(quotes.id, quote.id));
    const before = await header(quote.id);
    const beforeLines = await linesOf(quote.id);
    await deleteQuoteRecord(actor, quote.id, db(), NOW);
    const [item] = await bin(actor);

    expect(await restoreDeletedSentQuote(actor, item?.id ?? "", db(), later)).toEqual({ ok: true, quoteId: quote.id });

    expect(await header(quote.id)).toEqual(before);
    expect(await linesOf(quote.id)).toEqual(beforeLines);
    expect(await bin(actor)).toEqual([]);
    expect(await eventsOf("quote.restored")).toHaveLength(1);
  });

  it("leaves the old customer link closed, and lets the owner open a new one", async () => {
    const actor = await actorFor();
    const quote = await sentQuote(actor);
    await deleteQuoteRecord(actor, quote.id, db(), NOW);
    const [item] = await bin(actor);
    await restoreDeletedSentQuote(actor, item?.id ?? "", db(), later);

    expect(await getSharedQuote(quote.token, db())).toBeNull();
    const link = await createQuoteLink(actor, quote.id, { appUrl: "https://tavi.example" }, db());
    expect(link).toMatchObject({ ok: true });
    if (link.ok) expect(await getSharedQuote(link.url.split("/q/")[1] ?? "", db())).toMatchObject({ quote: { id: quote.id } });
  });

  it("is the owner's, and works once", async () => {
    const actor = await actorFor();
    const quote = await sentQuote(actor);
    await deleteQuoteRecord(actor, quote.id, db(), NOW);
    const [item] = await bin(actor);
    await expect(restoreDeletedSentQuote({ ...actor, role: "admin" }, item?.id ?? "", db())).rejects.toBeInstanceOf(ForbiddenError);
    expect(await restoreDeletedSentQuote(await actorFor(), item?.id ?? "", db(), later)).toEqual({ ok: false, notFound: true });
    expect(await restoreDeletedSentQuote(actor, item?.id ?? "", db(), later)).toMatchObject({ ok: true });
    expect(await restoreDeletedSentQuote(actor, item?.id ?? "", db(), later)).toEqual({ ok: false, notFound: true });
  });
});
