import { describe, expect, it } from "vitest";
import {
  type PaymentRow,
  type SalesRow,
  summarizePayments,
  summarizeSales,
  summarizeUnpaid,
  type UnpaidRow,
} from "./summaries";

const sale = (over: Partial<SalesRow> = {}): SalesRow => ({
  id: "i1",
  number: "INV-000001",
  title: "Billing statement",
  registered: false,
  issueDate: "2026-10-01",
  dueDate: "2026-10-16",
  status: "SENT",
  cancelled: false,
  customerId: "c1",
  customerName: "Juan Dela Cruz",
  customerTaxId: null,
  currency: "PHP",
  totalMinor: 112_000,
  taxMinor: 12_000,
  paidMinor: 0,
  vatableMinor: 100_000,
  vatMinor: 12_000,
  zeroRatedMinor: 0,
  exemptMinor: 0,
  ...over,
});

describe("summarizeSales", () => {
  it("totals issued bills per currency: before tax, tax, the tax breakdown and what's registered", () => {
    const summary = summarizeSales([
      sale(),
      sale({ id: "i2", registered: true, totalMinor: 50_000, taxMinor: 0, vatableMinor: 0, vatMinor: 0, exemptMinor: 50_000 }),
      sale({ id: "i3", currency: "USD", totalMinor: 10_000, taxMinor: 0, vatableMinor: 0, vatMinor: 0, zeroRatedMinor: 10_000 }),
    ]);

    expect(summary).toEqual([
      {
        currency: "PHP",
        issued: { count: 2, totalMinor: 162_000, netMinor: 150_000, taxMinor: 12_000 },
        registered: { count: 1, totalMinor: 50_000 },
        cancelled: { count: 0, totalMinor: 0 },
        breakdown: { vatableMinor: 100_000, vatMinor: 12_000, zeroRatedMinor: 0, exemptMinor: 50_000 },
      },
      {
        currency: "USD",
        issued: { count: 1, totalMinor: 10_000, netMinor: 10_000, taxMinor: 0 },
        registered: { count: 0, totalMinor: 0 },
        cancelled: { count: 0, totalMinor: 0 },
        breakdown: { vatableMinor: 0, vatMinor: 0, zeroRatedMinor: 10_000, exemptMinor: 0 },
      },
    ]);
  });

  it("keeps cancelled bills out of sales and counts them as cancelled revenue (D6)", () => {
    const [php] = summarizeSales([sale(), sale({ id: "i2", status: "CANCELLED", cancelled: true, totalMinor: 30_000 })]);

    expect(php?.issued).toEqual({ count: 1, totalMinor: 112_000, netMinor: 100_000, taxMinor: 12_000 });
    expect(php?.breakdown.vatableMinor).toBe(100_000);
    expect(php?.cancelled).toEqual({ count: 1, totalMinor: 30_000 });
  });

  it("still lists a currency whose only bills were cancelled", () => {
    expect(summarizeSales([sale({ cancelled: true, currency: "EUR" })]).map((s) => [s.currency, s.issued.count])).toEqual([
      ["EUR", 0],
    ]);
  });

  it("says nothing when there were no bills", () => {
    expect(summarizeSales([])).toEqual([]);
  });
});

const payment = (over: Partial<PaymentRow> = {}): PaymentRow => ({
  receiptNumber: "REC-000001",
  paidOn: "2026-10-01",
  method: "bank_transfer",
  reference: null,
  currency: "PHP",
  amountMinor: 98_000,
  withheldMinor: 2_000,
  invoiceNumber: "INV-000001",
  customerId: "c1",
  customerName: "Santos Aircon",
  customerTaxId: "123-456-789-00000",
  ...over,
});

describe("summarizePayments", () => {
  it("totals money received and tax withheld per currency, and by method, biggest first", () => {
    const [php, usd] = summarizePayments([
      payment(),
      payment({ receiptNumber: "REC-000002", method: "cash", amountMinor: 5_000, withheldMinor: 0 }),
      payment({ receiptNumber: "REC-000003", amountMinor: 1_000, withheldMinor: 0 }),
      payment({ receiptNumber: "REC-000004", currency: "USD", amountMinor: 700, withheldMinor: 0 }),
    ]);

    expect(php).toEqual({
      currency: "PHP",
      count: 3,
      receivedMinor: 104_000,
      withheldMinor: 2_000,
      byMethod: [
        { method: "bank_transfer", count: 2, receivedMinor: 99_000 },
        { method: "cash", count: 1, receivedMinor: 5_000 },
      ],
      withheldByCustomer: [
        { customerName: "Santos Aircon", customerTaxId: "123-456-789-00000", count: 1, withheldMinor: 2_000 },
      ],
    });
    expect(usd?.receivedMinor).toBe(700);
  });

  it("groups tax withheld by customer for matching their forms, biggest first", () => {
    const [php] = summarizePayments([
      payment({ customerId: "c1", withheldMinor: 1_000 }),
      payment({ customerId: "c2", customerName: "Reyes Clinic", customerTaxId: null, withheldMinor: 3_000 }),
      payment({ customerId: "c1", withheldMinor: 500 }),
      payment({ customerId: "c3", customerName: "Cash buyer", withheldMinor: 0 }),
    ]);

    expect(php?.withheldByCustomer).toEqual([
      { customerName: "Reyes Clinic", customerTaxId: null, count: 1, withheldMinor: 3_000 },
      { customerName: "Santos Aircon", customerTaxId: "123-456-789-00000", count: 2, withheldMinor: 1_500 },
    ]);
  });
});

const unpaid = (over: Partial<UnpaidRow> = {}): UnpaidRow => ({
  id: "i1",
  number: "INV-000001",
  title: "Billing statement",
  issueDate: "2026-09-01",
  dueDate: "2026-09-16",
  status: "OVERDUE",
  customerId: "c1",
  customerName: "Juan Dela Cruz",
  currency: "PHP",
  totalMinor: 100_000,
  paidMinor: 40_000,
  ...over,
});

describe("summarizeUnpaid", () => {
  const today = "2026-10-02";

  it("ages what's still owed per currency, and by customer, most owed first", () => {
    const [php] = summarizeUnpaid(
      [
        unpaid(),
        unpaid({ id: "i2", dueDate: "2026-10-10", status: "SENT", paidMinor: 0 }),
        unpaid({ id: "i3", customerId: "c2", customerName: "Ana Reyes", dueDate: "2026-06-01", totalMinor: 25_000, paidMinor: 0 }),
      ],
      today,
    );

    expect(php).toEqual({
      currency: "PHP",
      count: 3,
      outstandingMinor: 185_000,
      buckets: { current: 100_000, "1-30": 60_000, "31-60": 0, "61-90": 0, "over-90": 25_000 },
      byCustomer: [
        { customerName: "Juan Dela Cruz", count: 2, outstandingMinor: 160_000, oldestDueDate: "2026-09-16", daysOverdue: 16 },
        { customerName: "Ana Reyes", count: 1, outstandingMinor: 25_000, oldestDueDate: "2026-06-01", daysOverdue: 123 },
      ],
    });
  });

  it("leaves out bills with nothing left to pay", () => {
    expect(summarizeUnpaid([unpaid({ paidMinor: 100_000 })], today)).toEqual([]);
  });
});
