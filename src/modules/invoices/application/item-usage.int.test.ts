import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addTestMembership, closeTestDb, createTestOrganization, createTestUser, resetTables, testDb } from "@/db/testing";
import { MARKETS } from "@/config/markets";
import type { OrgActor } from "@/modules/authz";
import { createCatalogItem } from "@/modules/catalog";
import { createCustomer } from "@/modules/customers";
import { blankLine } from "@/modules/documents";
import { cancelInvoice } from "./corrections";
import { saveInvoiceDraft } from "./invoices";
import { invoiceItemUsage } from "./item-usage";
import { issueInvoice } from "./issuing";

const NOW = new Date("2026-10-01T02:00:00Z");
const issueOptions = { sender: { emailVerified: true }, market: MARKETS.PH, appUrl: "https://tavi.example", email: null, now: NOW };

async function business() {
  const org = await createTestOrganization(testDb(), { name: "Santos Aircon" });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com`, emailVerified: true });
  await addTestMembership(testDb(), { organizationId: org.id, userId: user.id, role: "owner" });
  const actor: OrgActor = { organizationId: org.id, userId: user.id, role: "owner" };
  const created = await createCustomer(actor, { displayName: "Juan Dela Cruz" }, testDb());
  if (!created.ok) throw new Error("customer");
  return { actor, customerId: created.customer.id };
}

async function product(actor: OrgActor, name: string) {
  const created = await createCatalogItem(
    actor,
    "product",
    { name, description: "", sku: "", unitLabel: "pc", unitPrice: "800", currency: "PHP", taxRateId: "" },
    { locale: "en-PH", units: { product: "pc", service: "hour" } },
    testDb(),
  );
  if (!created.ok) throw new Error("item");
  return created.item.id;
}

const fromItem = (itemId: string) => ({ ...blankLine(), description: "Air filter", quantity: "1", unitLabel: "pc", unitPrice: "800", sourceKind: "product" as const, sourceId: itemId });
const typedByHand = { ...blankLine(), description: "Travel", quantity: "1", unitLabel: "trip", unitPrice: "200" };

async function draft(
  { actor, customerId }: { actor: OrgActor; customerId: string },
  lines: ReturnType<typeof fromItem>[] | (typeof typedByHand)[],
  issueDate = "2026-10-01",
) {
  const saved = await saveInvoiceDraft(
    actor,
    null,
    { customerId, currency: "PHP", issueDate, dueDate: "2026-12-31", notes: "", terms: "", lines },
    { locale: "en-PH" },
    testDb(),
  );
  if (!saved.ok) throw new Error("invoice");
  return saved.invoice.id;
}

async function issued(biz: { actor: OrgActor; customerId: string }, lines: Parameters<typeof draft>[1], issueDate?: string) {
  const id = await draft(biz, lines, issueDate);
  const result = await issueInvoice(biz.actor, id, issueOptions, testDb());
  if (!result.ok) throw new Error("issue");
  return id;
}

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("how often issued billing statements used a product or service", () => {
  it("counts the issued statements that carry the item, once each however many lines, with the latest issue day", async () => {
    const biz = await business();
    const filter = await product(biz.actor, "Air filter");
    await issued(biz, [fromItem(filter)], "2026-09-18");
    await issued(biz, [fromItem(filter), fromItem(filter)], "2026-10-06");

    expect(await invoiceItemUsage(biz.actor, [filter], testDb())).toEqual([{ itemId: filter, count: 2, lastOn: "2026-10-06" }]);
  });

  it("ignores a draft, a cancelled statement, which never happened, and a line typed by hand", async () => {
    const biz = await business();
    const filter = await product(biz.actor, "Air filter");
    await draft(biz, [fromItem(filter)]);
    const cancelled = await issued(biz, [fromItem(filter)]);
    const result = await cancelInvoice(biz.actor, cancelled, "Job called off", testDb());
    if (!result.ok) throw new Error("cancel");
    await issued(biz, [typedByHand]);

    expect(await invoiceItemUsage(biz.actor, [filter], testDb())).toEqual([]);
    expect(await invoiceItemUsage(biz.actor, [], testDb())).toEqual([]);
  });

  it("is per item, and never shows another business's statements", async () => {
    const biz = await business();
    const filter = await product(biz.actor, "Air filter");
    const gas = await product(biz.actor, "Refrigerant");
    await issued(biz, [fromItem(filter)]);

    expect((await invoiceItemUsage(biz.actor, [filter, gas], testDb())).map((use) => use.itemId)).toEqual([filter]);
    const other = await business();
    expect(await invoiceItemUsage(other.actor, [filter], testDb())).toEqual([]);
  });
});
