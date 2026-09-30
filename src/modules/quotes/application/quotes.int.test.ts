import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  closeTestDb,
  createTestOrganization,
  createTestUser,
  listAllAuditEvents,
  resetTables,
  testDb,
} from "@/db/testing";
import type { OrgActor, Role } from "@/modules/authz";
import { archiveTaxRate, createTaxRate } from "@/modules/catalog";
import { createCustomer } from "@/modules/customers";
import { blankLine, type RawLine } from "@/modules/documents";
import type { RawQuoteDraft } from "../domain/quote-draft";
import { deleteDraftQuote, getQuote, listQuotes, newQuoteDefaults, saveQuoteDraft } from "./quotes";

const OPTIONS = { locale: "en-PH" };
const NOW = new Date("2026-09-30T16:30:00Z"); // 1 Oct in Manila

async function actorFor(role: Role = "member", name = "Acme"): Promise<OrgActor> {
  const org = await createTestOrganization(testDb(), { name, quoteValidityDays: 14, defaultTerms: "50% down" });
  const user = await createTestUser(testDb(), { email: `${crypto.randomUUID()}@example.com` });
  return { organizationId: org.id, userId: user.id, role };
}

async function customer(actor: OrgActor, displayName = "Juan Dela Cruz") {
  const result = await createCustomer(actor, { displayName }, testDb());
  if (!result.ok) throw new Error("customer");
  return result.customer;
}

async function vat(actor: OrgActor) {
  const result = await createTaxRate({ ...actor, role: "owner" }, { name: "VAT", rate: "12" }, OPTIONS, testDb());
  if (!result.ok) throw new Error("tax rate");
  return result.taxRate;
}

const line = (overrides: Partial<RawLine> = {}): RawLine => ({
  ...blankLine(),
  description: "Aircon cleaning",
  quantity: "2",
  unitLabel: "unit",
  unitPrice: "1,500",
  ...overrides,
});

function draft(overrides: Partial<RawQuoteDraft> = {}): RawQuoteDraft {
  return {
    customerId: "",
    currency: "PHP",
    issueDate: "2026-10-01",
    validUntil: "2026-10-15",
    notes: "",
    terms: "",
    lines: [line()],
    ...overrides,
  };
}

async function save(actor: OrgActor, input: RawQuoteDraft, id: string | null = null) {
  const result = await saveQuoteDraft(actor, id, input, OPTIONS, testDb());
  if (!result.ok) throw new Error(`save failed: ${JSON.stringify(result)}`);
  return result.quote;
}

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closeTestDb();
});

describe("newQuoteDefaults", () => {
  it("starts from the business's settings: today in its time zone, validity, terms and default tax", async () => {
    const actor = await actorFor();
    const created = await createTaxRate(
      { ...actor, role: "owner" },
      { name: "VAT", rate: "12", makeDefault: true },
      OPTIONS,
      testDb(),
    );
    if (!created.ok) throw new Error("tax rate");
    const rate = created.taxRate;

    expect(await newQuoteDefaults(actor, testDb(), NOW)).toEqual({
      currency: "PHP",
      taxMode: "inclusive",
      issueDate: "2026-10-01",
      validUntil: "2026-10-15",
      notes: "",
      terms: "50% down",
      defaultTaxRateId: rate.id,
    });
  });
});

describe("saveQuoteDraft", () => {
  it("creates a draft with lines and totals from the one calculation, and audits the creation", async () => {
    const actor = await actorFor();
    const rate = await vat(actor);
    const juan = await customer(actor);

    const quote = await save(actor, draft({ customerId: juan.id, lines: [line({ taxRateId: rate.id })] }));

    expect(quote).toMatchObject({
      status: "DRAFT",
      number: null,
      revision: 1,
      customerId: juan.id,
      taxMode: "inclusive",
      subtotalMinor: 300_000,
      taxTotalMinor: 32_143, // 3,000.00 incl. 12%: 3,000 − 2,678.57
      totalMinor: 300_000,
    });
    const saved = await getQuote(actor, quote.id, testDb());
    expect(saved?.lines).toEqual([
      expect.objectContaining({
        position: 0,
        description: "Aircon cleaning",
        quantity: 20_000,
        unitPriceMinor: 150_000,
        taxRateId: rate.id,
        taxRateName: "VAT",
        taxRateBps: 1200,
        totalMinor: 300_000,
      }),
    ]);
    expect((await listAllAuditEvents(testDb())).map((e) => e.action).at(-1)).toBe("quote.created");
  });

  it("autosaves over the same draft, replacing its lines in order, without auditing every keystroke", async () => {
    const actor = await actorFor();
    const quote = await save(actor, draft());
    const eventsBefore = (await listAllAuditEvents(testDb())).length;

    await save(actor, draft({ lines: [line({ description: "Filter" }), line({ description: "Labour" })] }), quote.id);

    const saved = await getQuote(actor, quote.id, testDb());
    expect(saved?.lines.map((l) => [l.position, l.description])).toEqual([
      [0, "Filter"],
      [1, "Labour"],
    ]);
    expect((await listAllAuditEvents(testDb())).length).toBe(eventsBefore);
  });

  it("returns field errors and saves nothing for invalid input", async () => {
    const actor = await actorFor();

    const result = await saveQuoteDraft(actor, null, draft({ lines: [line({ quantity: "x" })] }), OPTIONS, testDb());

    expect(result).toEqual({ ok: false, errors: { "lines.0.quantity": "Enter a quantity like 1.5." } });
    expect((await listQuotes(actor, {}, testDb())).quotes).toEqual([]);
  });

  it("only accepts the business's own customer and tax rates", async () => {
    const actor = await actorFor("member", "One");
    const other = await actorFor("owner", "Two");
    const theirCustomer = await customer(other);
    const theirRate = await vat(other);
    const archived = await vat(actor);
    await archiveTaxRate({ ...actor, role: "owner" }, archived.id, testDb());

    expect(await saveQuoteDraft(actor, null, draft({ customerId: theirCustomer.id }), OPTIONS, testDb())).toEqual({
      ok: false,
      errors: { customerId: "Choose a customer from the list." },
    });
    expect(
      await saveQuoteDraft(
        actor,
        null,
        draft({ lines: [line(), line({ taxRateId: theirRate.id }), line({ taxRateId: archived.id })] }),
        OPTIONS,
        testDb(),
      ),
    ).toEqual({
      ok: false,
      errors: {
        "lines.1.taxRateId": "Choose a tax rate from the list.",
        "lines.2.taxRateId": "Choose a tax rate from the list.",
      },
    });
  });

  it("keeps a tax rate archived after the draft started using it", async () => {
    const actor = await actorFor();
    const rate = await vat(actor);
    const quote = await save(actor, draft({ lines: [line({ taxRateId: rate.id })] }));
    await archiveTaxRate({ ...actor, role: "owner" }, rate.id, testDb());

    const result = await saveQuoteDraft(
      actor,
      quote.id,
      draft({ notes: "Updated", lines: [line({ taxRateId: rate.id })] }),
      OPTIONS,
      testDb(),
    );

    expect(result).toMatchObject({ ok: true, quote: { notes: "Updated" } });
  });

  it("treats another business's quote as not found", async () => {
    const owner = await actorFor("owner", "One");
    const quote = await save(owner, draft());
    const intruder = await actorFor("owner", "Two");

    expect(await saveQuoteDraft(intruder, quote.id, draft({ notes: "Hacked" }), OPTIONS, testDb())).toEqual({
      ok: false,
      notFound: true,
    });
    expect(await getQuote(intruder, quote.id, testDb())).toBeNull();
    expect((await getQuote(owner, quote.id, testDb()))?.notes).toBeNull();
  });
});

describe("listQuotes", () => {
  it("lists the business's quotes, newest first, with the customer's name, and finds them by customer", async () => {
    const actor = await actorFor("member", "One");
    const juan = await customer(actor, "Juan Dela Cruz");
    const ana = await customer(actor, "Ana Reyes");
    await save(actor, draft({ customerId: juan.id }));
    await save(actor, draft({ customerId: ana.id }));
    await save(actor, draft());
    await save(await actorFor("owner", "Two"), draft());

    const all = await listQuotes(actor, {}, testDb());
    expect(all.quotes.map((q) => q.customerName)).toEqual([null, "Ana Reyes", "Juan Dela Cruz"]);
    expect(all.quotes[0]).toMatchObject({ status: "DRAFT", number: null, totalMinor: 300_000, currency: "PHP" });

    const found = await listQuotes(actor, { search: "juan" }, testDb());
    expect(found.quotes.map((q) => q.customerName)).toEqual(["Juan Dela Cruz"]);
  });
});

describe("deleteDraftQuote", () => {
  it("deletes a never-sent draft and audits it; another business can't", async () => {
    const owner = await actorFor("member", "One");
    const quote = await save(owner, draft());
    const intruder = await actorFor("owner", "Two");

    expect(await deleteDraftQuote(intruder, quote.id, testDb())).toEqual({ ok: false, notFound: true });
    expect(await deleteDraftQuote(owner, quote.id, testDb())).toEqual({ ok: true });
    expect(await getQuote(owner, quote.id, testDb())).toBeNull();
    expect((await listAllAuditEvents(testDb())).map((e) => e.action).at(-1)).toBe("quote.deleted");
  });
});
