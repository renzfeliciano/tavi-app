import { describe, expect, it } from "vitest";
import type { CustomerActivity, CustomerSummary } from "@/modules/customers";
import type { CustomerMoney } from "@/modules/invoices";
import { customerRows, owingFrom } from "./figures";

const money = (over: Partial<CustomerMoney> = {}): CustomerMoney => ({
  customerId: "juan",
  currency: "PHP",
  billedMinor: 300_000,
  paidMinor: 100_000,
  owedMinor: 200_000,
  overdueMinor: 0,
  count: 2,
  ...over,
});
const customer = (id: string): CustomerSummary => ({
  id,
  displayName: id,
  company: null,
  email: null,
  phone: null,
  city: null,
  category: null,
  archivedAt: null,
});

describe("owingFrom", () => {
  it("lists what is still owed, per currency, with how much of it is overdue", () => {
    const rows = [money({ owedMinor: 200_000, overdueMinor: 50_000 }), money({ currency: "USD", owedMinor: 7_000 })];

    expect(owingFrom(rows)).toEqual([
      { currency: "PHP", owedMinor: 200_000, overdueMinor: 50_000 },
      { currency: "USD", owedMinor: 7_000, overdueMinor: 0 },
    ]);
  });

  it("leaves out a currency that is settled, so a customer who has paid up owes nothing", () => {
    expect(owingFrom([money({ owedMinor: 0, paidMinor: 300_000 })])).toEqual([]);
    expect(owingFrom([])).toEqual([]);
  });
});

describe("customerRows", () => {
  const manila = "Asia/Manila";
  const today = "2026-10-14";
  const changes = (entries: [string, CustomerActivity][]) => new Map(entries);

  it("puts each customer's money and last activity on their row, and leaves a new customer's empty", () => {
    const rows = customerRows({
      customers: [customer("juan"), customer("maria"), customer("pedro")],
      money: [money(), money({ customerId: "maria", owedMinor: 0, paidMinor: 300_000 })],
      // 2026-10-13T17:00Z is 1:00 a.m. on 14 Oct in Manila.
      changes: changes([["juan", { at: new Date("2026-10-13T17:00:00Z"), kind: "invoice" }]]),
      timezone: manila,
      today,
      locale: "en-PH",
    });

    expect(rows.map((row) => row.id)).toEqual(["juan", "maria", "pedro"]);
    expect(rows[0]?.owing).toEqual([{ currency: "PHP", owedMinor: 200_000, overdueMinor: 0 }]);
    expect(rows[0]?.activity).toEqual({ on: "2026-10-14", when: "Today", kind: "invoice" });
    expect(rows[1]?.owing).toEqual([]);
    expect(rows[1]?.activity).toBeNull();
    expect(rows[2]?.owing).toEqual([]);
    expect(rows[2]?.activity).toBeNull();
  });

  it("keeps a customer's currencies together and in order", () => {
    const [row] = customerRows({
      customers: [customer("juan")],
      money: [money({ currency: "PHP" }), money({ currency: "USD", owedMinor: 5_000 })],
      changes: changes([]),
      timezone: manila,
      today,
      locale: "en-PH",
    });

    expect(row?.owing.map((o) => o.currency)).toEqual(["PHP", "USD"]);
  });
});
