import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addTestMembership, closeTestDb, createTestOrganization, createTestUser, resetTables, testDb } from "@/db/testing";
import { MARKETS } from "@/config/markets";
import type { OrgActor } from "@/modules/authz";
import { createCatalogItem } from "@/modules/catalog";
import { createCustomer } from "@/modules/customers";
import { blankLine } from "@/modules/documents";
import { quoteItemUsage } from "./item-usage";
import { saveQuoteDraft } from "./quotes";
import { cancelQuote, sendQuote } from "./sending";

const NOW = new Date("2026-10-01T02:00:00Z");
const sendOptions = { sender: { emailVerified: true }, market: MARKETS.PH, appUrl: "https://tavi.example", email: null, now: NOW };

async function business() {
  const org = await createTestOrganization(testDb(), { name: "Santos Aircon" });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com`, emailVerified: true });
  await addTestMembership(testDb(), { organizationId: org.id, userId: user.id, role: "owner" });
  const actor: OrgActor = { organizationId: org.id, userId: user.id, role: "owner" };
  const created = await createCustomer(actor, { displayName: "Juan Dela Cruz" }, testDb());
  if (!created.ok) throw new Error("customer");
  return { actor, customerId: created.customer.id };
}

async function service(actor: OrgActor, name: string) {
  const created = await createCatalogItem(
    actor,
    "service",
    { name, description: "", sku: "", unitLabel: "hour", unitPrice: "500", currency: "PHP", taxRateId: "" },
    { locale: "en-PH", units: { product: "pc", service: "hour" } },
    testDb(),
  );
  if (!created.ok) throw new Error("item");
  return created.item.id;
}

const fromItem = (itemId: string) => ({ ...blankLine(), description: "Aircon cleaning", quantity: "1", unitLabel: "hour", unitPrice: "500", sourceKind: "service" as const, sourceId: itemId });
const typedByHand = { ...blankLine(), description: "Travel", quantity: "1", unitLabel: "trip", unitPrice: "200" };

async function quote(
  { actor, customerId }: { actor: OrgActor; customerId: string },
  lines: ReturnType<typeof fromItem>[] | (typeof typedByHand)[],
  { issueDate = "2026-10-01", send = true } = {},
) {
  const saved = await saveQuoteDraft(
    actor,
    null,
    { customerId, currency: "PHP", issueDate, validUntil: "2026-12-31", notes: "", terms: "", lines },
    { locale: "en-PH" },
    testDb(),
  );
  if (!saved.ok) throw new Error("quote");
  if (send) {
    const sent = await sendQuote(actor, saved.quote.id, sendOptions, testDb());
    if (!sent.ok) throw new Error("send");
  }
  return saved.quote.id;
}

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("how often sent quotations used a product or service", () => {
  it("counts the sent quotations that carry the item, once each however many lines, with the latest issue day", async () => {
    const biz = await business();
    const cleaning = await service(biz.actor, "Aircon cleaning");
    await quote(biz, [fromItem(cleaning)], { issueDate: "2026-09-20" });
    await quote(biz, [fromItem(cleaning), fromItem(cleaning)], { issueDate: "2026-10-05" });

    expect(await quoteItemUsage(biz.actor, [cleaning], testDb())).toEqual([{ itemId: cleaning, count: 2, lastOn: "2026-10-05" }]);
  });

  it("is per item, and leaves out an item no sent quotation carries", async () => {
    const biz = await business();
    const cleaning = await service(biz.actor, "Aircon cleaning");
    const repair = await service(biz.actor, "Aircon repair");
    const unused = await service(biz.actor, "Installation");
    await quote(biz, [fromItem(cleaning), fromItem(repair)]);
    await quote(biz, [fromItem(repair)]);

    const usage = await quoteItemUsage(biz.actor, [cleaning, repair, unused], testDb());
    expect(usage.map(({ itemId, count }) => [itemId, count]).sort()).toEqual(
      [
        [cleaning, 1],
        [repair, 2],
      ].sort(),
    );
  });

  it("ignores a draft, which is only the business's own work, and a line typed by hand", async () => {
    const biz = await business();
    const cleaning = await service(biz.actor, "Aircon cleaning");
    await quote(biz, [fromItem(cleaning)], { send: false });
    await quote(biz, [typedByHand]);

    expect(await quoteItemUsage(biz.actor, [cleaning], testDb())).toEqual([]);
    expect(await quoteItemUsage(biz.actor, [], testDb())).toEqual([]);
  });

  it("ignores a quotation that was called off before it was ever sent", async () => {
    const biz = await business();
    const cleaning = await service(biz.actor, "Aircon cleaning");
    const id = await quote(biz, [fromItem(cleaning)], { send: false });
    expect((await cancelQuote(biz.actor, id, "Changed my mind", testDb())).ok).toBe(true);

    expect(await quoteItemUsage(biz.actor, [cleaning], testDb())).toEqual([]);
  });

  it("still counts one that was sent and then called off: the customer did get it", async () => {
    const biz = await business();
    const cleaning = await service(biz.actor, "Aircon cleaning");
    const id = await quote(biz, [fromItem(cleaning)]);
    expect((await cancelQuote(biz.actor, id, "Customer withdrew", testDb())).ok).toBe(true);

    expect(await quoteItemUsage(biz.actor, [cleaning], testDb())).toEqual([{ itemId: cleaning, count: 1, lastOn: "2026-10-01" }]);
  });

  it("never shows another business's quotations", async () => {
    const biz = await business();
    const cleaning = await service(biz.actor, "Aircon cleaning");
    await quote(biz, [fromItem(cleaning)]);

    const other = await business();
    expect(await quoteItemUsage(other.actor, [cleaning], testDb())).toEqual([]);
  });
});
