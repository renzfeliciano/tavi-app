import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  closeTestDb,
  createTestOrganization,
  createTestUser,
  listAllAuditEvents,
  listAllOutboxMessages,
  resetTables,
  testDb,
} from "@/db/testing";
import { MARKETS } from "@/config/markets";
import type { OrgActor, Role } from "@/modules/authz";
import { createCustomer } from "@/modules/customers";
import { blankLine } from "@/modules/documents";
import type { RawQuoteDraft } from "../domain/quote-draft";
import { getQuote, saveQuoteDraft } from "./quotes";
import { cancelQuote, createQuoteLink, getSharedQuote, reviseQuote, sendQuote } from "./sending";

const APP_URL = "https://tavi.example";
const NOW = new Date("2026-10-01T02:00:00Z"); // 1 Oct in Manila
const VERIFIED = { emailVerified: true };

async function actorFor(role: Role = "member", name = "Santos Aircon"): Promise<OrgActor> {
  const org = await createTestOrganization(testDb(), { name, email: "billing@santos.example" });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com` });
  return { organizationId: org.id, userId: user.id, role };
}

async function draftQuote(actor: OrgActor, overrides: Partial<RawQuoteDraft> = {}) {
  const customer = await createCustomer(
    actor,
    { displayName: "Juan Dela Cruz", email: "juan@example.com", city: "Pasig", taxId: "987-654-321-00000" },
    testDb(),
  );
  if (!customer.ok) throw new Error("customer");
  const saved = await saveQuoteDraft(
    actor,
    null,
    {
      customerId: customer.customer.id,
      currency: "PHP",
      issueDate: "2026-10-01",
      validUntil: "2026-10-15",
      notes: "",
      terms: "",
      lines: [{ ...blankLine(), description: "Aircon cleaning", quantity: "2", unitLabel: "unit", unitPrice: "1,500" }],
      ...overrides,
    },
    { locale: "en-PH" },
    testDb(),
  );
  if (!saved.ok) throw new Error(`draft: ${JSON.stringify(saved)}`);
  return saved.quote;
}

const options = (overrides: Partial<Parameters<typeof sendQuote>[2]> = {}) => ({
  sender: VERIFIED,
  market: MARKETS.PH,
  appUrl: APP_URL,
  email: null,
  now: NOW,
  ...overrides,
});

const tokenOf = (url: string) => url.split("/q/")[1] ?? "";

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("sendQuote", () => {
  it("numbers the quote, snapshots the customer, opens a link and audits it (by link)", async () => {
    const actor = await actorFor();
    const draft = await draftQuote(actor);

    const result = await sendQuote(actor, draft.id, options(), testDb());

    expect(result).toEqual({ ok: true, number: "QUO-000001", url: expect.stringMatching(/^https:\/\/tavi\.example\/q\/[\w-]{43}$/) });
    const quote = await getQuote(actor, draft.id, testDb());
    expect(quote).toMatchObject({
      status: "SENT",
      number: "QUO-000001",
      sentAt: expect.any(Date),
      customerSnapshot: {
        displayName: "Juan Dela Cruz",
        email: "juan@example.com",
        addressLines: ["Pasig"],
        taxId: "987-654-321-00000",
      },
    });
    expect((await listAllAuditEvents(testDb())).at(-1)).toMatchObject({
      action: "quote.sent",
      entityId: draft.id,
      metadata: { number: "QUO-000001", revision: 1, channel: "link", totalMinor: 300_000, currency: "PHP" },
    });
    expect(await listAllOutboxMessages(testDb())).toEqual([]);
    if (result.ok) expect(await getSharedQuote(tokenOf(result.url), testDb())).toMatchObject({ quote: { id: draft.id } });
  });

  it("queues the email from the business, with replies going to the business", async () => {
    const actor = await actorFor();
    const draft = await draftQuote(actor);

    const result = await sendQuote(
      actor,
      draft.id,
      options({ email: { to: "Juan@Example.com", message: "Hi Juan, here's the quote." } }),
      testDb(),
    );

    expect(result.ok).toBe(true);
    const [message] = await listAllOutboxMessages(testDb());
    expect(message).toMatchObject({ organizationId: actor.organizationId });
    expect(message?.payload).toMatchObject({
      to: "juan@example.com",
      subject: "Quotation QUO-000001 from Santos Aircon",
      senderName: "Santos Aircon via Tavi",
      replyTo: "billing@santos.example",
    });
    expect(String(message?.payload.text)).toContain(result.ok ? result.url : "");
    expect((await listAllAuditEvents(testDb())).at(-1)?.metadata).toMatchObject({ channel: "email" });
  });

  it("won't send until the sender's own email is confirmed", async () => {
    const actor = await actorFor();
    const draft = await draftQuote(actor);

    expect(await sendQuote(actor, draft.id, options({ sender: { emailVerified: false } }), testDb())).toEqual({
      ok: false,
      error: "Confirm your email address before sending. We sent you a link when you signed up.",
    });
    expect((await getQuote(actor, draft.id, testDb()))?.status).toBe("DRAFT");
  });

  it("explains what's missing, and checks the email address", async () => {
    const actor = await actorFor();
    const draft = await draftQuote(actor, { customerId: "", lines: [], validUntil: "2026-10-01", issueDate: "2026-09-01" });

    expect(await sendQuote(actor, draft.id, options({ now: new Date("2026-10-05T02:00:00Z") }), testDb())).toEqual({
      ok: false,
      errors: {
        customerId: "Choose a customer before sending.",
        lines: "Add at least one item before sending.",
        validUntil: "This quote's valid-until date has passed. Choose a date from today on.",
      },
    });
    const ready = await draftQuote(actor);
    expect(await sendQuote(actor, ready.id, options({ email: { to: "not an email", message: "" } }), testDb())).toEqual({
      ok: false,
      errors: { emailTo: "Enter a valid email address." },
    });
  });

  it("sends a quote only once, and never another business's quote", async () => {
    const actor = await actorFor("member", "One");
    const draft = await draftQuote(actor);
    await sendQuote(actor, draft.id, options(), testDb());

    expect(await sendQuote(actor, draft.id, options(), testDb())).toEqual({
      ok: false,
      error: "This quote was already sent. Revise it to make changes and send it again.",
    });
    const intruder = await actorFor("owner", "Two");
    expect(await sendQuote(intruder, draft.id, options(), testDb())).toEqual({ ok: false, notFound: true });
  });
});

describe("reviseQuote", () => {
  it("reopens a sent quote as the next revision, keeps its number, and closes the old link", async () => {
    const actor = await actorFor();
    const draft = await draftQuote(actor);
    const sent = await sendQuote(actor, draft.id, options(), testDb());
    if (!sent.ok) throw new Error("send");

    expect(await reviseQuote(actor, draft.id, testDb(), NOW)).toEqual({ ok: true });
    expect(await getQuote(actor, draft.id, testDb())).toMatchObject({
      status: "DRAFT",
      revision: 2,
      number: "QUO-000001",
      customerSnapshot: null,
      validUntil: "2026-10-31",
    });
    expect(await getSharedQuote(tokenOf(sent.url), testDb())).toBeNull();

    const resent = await sendQuote(actor, draft.id, options(), testDb());
    expect(resent).toMatchObject({ ok: true, number: "QUO-000001" });
    expect((await listAllAuditEvents(testDb())).map((e) => e.action).slice(-3)).toEqual([
      "quote.sent",
      "quote.revised",
      "quote.sent",
    ]);
  });

  it("can't revise a draft", async () => {
    const actor = await actorFor();
    const draft = await draftQuote(actor);
    expect(await reviseQuote(actor, draft.id, testDb(), NOW)).toEqual({ ok: false, error: "Only a sent quote can be revised." });
  });
});

describe("createQuoteLink", () => {
  it("opens another link to a sent quote without closing the first", async () => {
    const actor = await actorFor();
    const draft = await draftQuote(actor);
    const sent = await sendQuote(actor, draft.id, options(), testDb());
    if (!sent.ok) throw new Error("send");

    const again = await createQuoteLink(actor, draft.id, { appUrl: APP_URL }, testDb());

    expect(again).toMatchObject({ ok: true });
    if (!again.ok) return;
    expect(again.url).not.toBe(sent.url);
    expect(await getSharedQuote(tokenOf(sent.url), testDb())).not.toBeNull();
    expect(await getSharedQuote(tokenOf(again.url), testDb())).not.toBeNull();
    expect((await listAllAuditEvents(testDb())).at(-1)?.action).toBe("quote.link_created");
  });

  it("has no link for a draft", async () => {
    const actor = await actorFor();
    const draft = await draftQuote(actor);
    expect(await createQuoteLink(actor, draft.id, { appUrl: APP_URL }, testDb())).toEqual({
      ok: false,
      error: "Send the quote first; its link opens then.",
    });
  });
});

describe("cancelQuote", () => {
  it("cancels with a reason, closes its links and audits it", async () => {
    const actor = await actorFor();
    const draft = await draftQuote(actor);
    const sent = await sendQuote(actor, draft.id, options(), testDb());
    if (!sent.ok) throw new Error("send");

    expect(await cancelQuote(actor, draft.id, " Customer went with another shop ", testDb())).toEqual({ ok: true });
    expect(await getQuote(actor, draft.id, testDb())).toMatchObject({
      status: "CANCELLED",
      cancelledAt: expect.any(Date),
    });
    expect(await getSharedQuote(tokenOf(sent.url), testDb())).toBeNull();
    expect((await listAllAuditEvents(testDb())).at(-1)).toMatchObject({
      action: "quote.cancelled",
      metadata: { reason: "Customer went with another shop", number: "QUO-000001" },
    });
  });

  it("won't cancel twice, or cancel another business's quote", async () => {
    const actor = await actorFor("member", "One");
    const draft = await draftQuote(actor);
    await cancelQuote(actor, draft.id, "", testDb());
    expect(await cancelQuote(actor, draft.id, "", testDb())).toEqual({ ok: false, error: "This quote can't be cancelled." });
    const intruder = await actorFor("owner", "Two");
    expect(await cancelQuote(intruder, draft.id, "", testDb())).toEqual({ ok: false, notFound: true });
  });
});

describe("getSharedQuote", () => {
  it("gives the customer the quote and the business's letterhead, nothing more", async () => {
    const actor = await actorFor();
    const draft = await draftQuote(actor);
    const sent = await sendQuote(actor, draft.id, options(), testDb());
    if (!sent.ok) throw new Error("send");

    const shared = await getSharedQuote(tokenOf(sent.url), testDb());

    expect(shared).toMatchObject({
      quote: { id: draft.id, number: "QUO-000001", status: "SENT", totalMinor: 300_000 },
      business: { name: "Santos Aircon", email: "billing@santos.example" },
      countryCode: "PH",
      locale: "en-PH",
    });
    expect(shared?.quote.lines).toHaveLength(1);
    expect(await getSharedQuote("x".repeat(43), testDb())).toBeNull();
  });
});
