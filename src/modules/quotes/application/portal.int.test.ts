import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  addTestMembership,
  closeTestDb,
  createTestOrganization,
  createTestUser,
  listAllAuditEvents,
  listAllOutboxMessages,
  resetTables,
  testDb,
} from "@/db/testing";
import { MARKETS } from "@/config/markets";
import type { OrgActor } from "@/modules/authz";
import { createCustomer } from "@/modules/customers";
import { blankLine } from "@/modules/documents";
import { decideSharedQuote, recordSharedQuoteOpen, sharedQuoteContentHash } from "./portal";
import { getQuote, saveQuoteDraft } from "./quotes";
import { cancelQuote, getSharedQuote, reviseQuote, sendQuote } from "./sending";

const APP_URL = "https://tavi.example";
const NOW = new Date("2026-10-01T02:00:00Z"); // 1 Oct in Manila
const VISITOR = { ipAddress: "203.0.113.7", userAgent: "Mozilla/5.0 (test)" };

async function sentQuote(validUntil = "2026-10-15") {
  const org = await createTestOrganization(testDb(), { name: "Santos Aircon" });
  const owner = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com`, emailVerified: true });
  await addTestMembership(testDb(), { organizationId: org.id, userId: owner.id, role: "owner" });
  const actor: OrgActor = { organizationId: org.id, userId: owner.id, role: "owner" };
  const customer = await createCustomer(actor, { displayName: "Juan Dela Cruz", email: "juan@example.com" }, testDb());
  if (!customer.ok) throw new Error("customer");
  const saved = await saveQuoteDraft(
    actor,
    null,
    {
      customerId: customer.customer.id,
      currency: "PHP",
      issueDate: "2026-10-01",
      validUntil,
      notes: "",
      terms: "50% down payment.",
      lines: [{ ...blankLine(), description: "Aircon cleaning", quantity: "2", unitLabel: "unit", unitPrice: "1,500" }],
    },
    { locale: "en-PH" },
    testDb(),
  );
  if (!saved.ok) throw new Error("draft");
  const sent = await sendQuote(
    actor,
    saved.quote.id,
    { sender: { emailVerified: true }, market: MARKETS.PH, appUrl: APP_URL, email: null, now: NOW },
    testDb(),
  );
  if (!sent.ok) throw new Error("send");
  const token = sent.url.split("/q/")[1] ?? "";
  return { actor, owner, id: saved.quote.id, token };
}

async function hashOf(token: string) {
  const shared = await getSharedQuote(token, testDb());
  if (!shared) throw new Error("not shared");
  return sharedQuoteContentHash(shared.quote);
}

const approve = (name = "Juan Dela Cruz") => ({ kind: "approve" as const, name, accepted: true });
const options = (contentHash: string, now = NOW) => ({ ...VISITOR, contentHash, appUrl: APP_URL, now });

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("recordSharedQuoteOpen", () => {
  it("marks a sent quote VIEWED on the customer's first open, once", async () => {
    const { actor, id, token } = await sentQuote();
    await recordSharedQuoteOpen(token, testDb());
    await recordSharedQuoteOpen(token, testDb());

    const quote = await getQuote(actor, id, testDb());
    expect(quote?.status).toBe("VIEWED");
    expect(quote?.viewedAt).toBeInstanceOf(Date);
    const views = (await listAllAuditEvents(testDb())).filter((e) => e.action === "quote.viewed");
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ actorType: "customer", organizationId: actor.organizationId, entityId: id });
  });

  it("does nothing for an unknown link", async () => {
    await expect(recordSharedQuoteOpen("x".repeat(43), testDb())).resolves.toBeUndefined();
  });
});

describe("decideSharedQuote", () => {
  it("approves with the typed name, the content hash, IP and user agent, and tells the business", async () => {
    const { actor, owner, id, token } = await sentQuote();
    const contentHash = await hashOf(token);

    expect(await decideSharedQuote(token, approve(), options(contentHash), testDb())).toEqual({
      ok: true,
      status: "APPROVED",
    });

    const quote = await getQuote(actor, id, testDb());
    expect(quote).toMatchObject({ status: "APPROVED", decisionName: "Juan Dela Cruz", decisionNote: null });
    expect(quote?.decidedAt).toBeInstanceOf(Date);
    const event = (await listAllAuditEvents(testDb())).at(-1);
    expect(event).toMatchObject({
      action: "quote.approved",
      actorType: "customer",
      entityId: id,
      ipAddress: VISITOR.ipAddress,
      userAgent: VISITOR.userAgent,
    });
    expect(event?.metadata).toMatchObject({ name: "Juan Dela Cruz", contentHash, number: "QUO-000001" });
    const [message] = await listAllOutboxMessages(testDb());
    expect(message?.payload).toMatchObject({
      to: owner.email,
      subject: "Juan Dela Cruz approved Quotation QUO-000001",
    });
    expect(JSON.stringify(message?.payload)).toContain(`${APP_URL}/quotes/${id}`);
    // The customer can still open the approved quote.
    expect((await getSharedQuote(token, testDb()))?.quote.status).toBe("APPROVED");
  });

  it("declines with an optional reason", async () => {
    const { actor, id, token } = await sentQuote();
    const result = await decideSharedQuote(
      token,
      { kind: "reject", reason: "Found a cheaper option" },
      options(await hashOf(token)),
      testDb(),
    );
    expect(result).toEqual({ ok: true, status: "REJECTED" });
    expect(await getQuote(actor, id, testDb())).toMatchObject({
      status: "REJECTED",
      decisionNote: "Found a cheaper option",
      decisionName: null,
    });
    expect((await listAllAuditEvents(testDb())).at(-1)?.action).toBe("quote.rejected");
  });

  it("returns field errors without changing anything", async () => {
    const { actor, id, token } = await sentQuote();
    const result = await decideSharedQuote(
      token,
      { kind: "approve", name: "", accepted: false },
      options(await hashOf(token)),
      testDb(),
    );
    expect(result).toMatchObject({ ok: false, errors: { name: "Enter your name." } });
    expect((await getQuote(actor, id, testDb()))?.status).toBe("SENT");
  });

  it("expires the quote instead of approving it after its valid-until date", async () => {
    const { actor, id, token } = await sentQuote("2026-10-02");
    const contentHash = await hashOf(token);
    const later = new Date("2026-10-03T02:00:00Z");

    expect(await decideSharedQuote(token, approve(), options(contentHash, later), testDb())).toEqual({
      ok: false,
      reason: "expired",
      validUntil: "2026-10-02",
      // Formatting comes from the business, never from the browser (§I).
      locale: "en-PH",
      businessName: "Santos Aircon",
    });
    expect((await getQuote(actor, id, testDb()))?.status).toBe("EXPIRED");
    expect((await listAllAuditEvents(testDb())).at(-1)).toMatchObject({ action: "quote.expired", actorType: "system" });
    expect(await listAllOutboxMessages(testDb())).toEqual([]);
  });

  it("refuses a malformed decision without touching the quote", async () => {
    const { actor, id, token } = await sentQuote("2026-10-02");
    const contentHash = await hashOf(token);

    expect(
      await decideSharedQuote(token, { kind: "approve", name: "Juan", accepted: "true" }, options(contentHash), testDb()),
    ).toEqual({ ok: false, reason: "malformed" });
    expect((await getQuote(actor, id, testDb()))?.status).toBe("SENT");
  });

  it("refuses content that changed since the customer loaded it", async () => {
    const { actor, id, token } = await sentQuote();
    expect(await decideSharedQuote(token, approve(), options("0".repeat(64)), testDb())).toEqual({
      ok: false,
      reason: "changed",
    });
    expect((await getQuote(actor, id, testDb()))?.status).toBe("SENT");
  });

  it("refuses a second decision", async () => {
    const { token } = await sentQuote();
    const contentHash = await hashOf(token);
    await decideSharedQuote(token, approve(), options(contentHash), testDb());
    expect(await decideSharedQuote(token, { kind: "reject", reason: "" }, options(contentHash), testDb())).toEqual({
      ok: false,
      reason: "closed",
    });
  });

  it("finds nothing through a revoked link (revised or cancelled)", async () => {
    const revised = await sentQuote();
    const hash = await hashOf(revised.token);
    await reviseQuote(revised.actor, revised.id, testDb(), NOW);
    expect(await decideSharedQuote(revised.token, approve(), options(hash), testDb())).toEqual({
      ok: false,
      reason: "unavailable",
    });

    const cancelled = await sentQuote();
    const cancelledHash = await hashOf(cancelled.token);
    await cancelQuote(cancelled.actor, cancelled.id, "", testDb());
    expect(await decideSharedQuote(cancelled.token, approve(), options(cancelledHash), testDb())).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});
