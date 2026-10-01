import { describe, expect, it } from "vitest";
import {
  INVOICE_LINK_DAYS_AFTER_DUE,
  INVOICE_LINK_DAYS_AFTER_PAID,
  invoiceLinkExpiresAt,
  issuedInvoiceStatus,
  isPayable,
  readinessToIssue,
} from "./issuing";

describe("issuedInvoiceStatus", () => {
  const today = "2026-10-01";

  it("is PAID once active payments cover the total, whatever the date", () => {
    expect(issuedInvoiceStatus({ totalMinor: 1000, paidMinor: 1000, dueDate: "2026-09-01" }, today)).toBe("PAID");
  });

  it("is OVERDUE after the due date while anything is owed, even part-paid", () => {
    expect(issuedInvoiceStatus({ totalMinor: 1000, paidMinor: 0, dueDate: "2026-09-30" }, today)).toBe("OVERDUE");
    expect(issuedInvoiceStatus({ totalMinor: 1000, paidMinor: 400, dueDate: "2026-09-30" }, today)).toBe("OVERDUE");
  });

  it("is PARTIALLY_PAID or SENT up to and including the due date", () => {
    expect(issuedInvoiceStatus({ totalMinor: 1000, paidMinor: 400, dueDate: today }, today)).toBe("PARTIALLY_PAID");
    expect(issuedInvoiceStatus({ totalMinor: 1000, paidMinor: 0, dueDate: today }, today)).toBe("SENT");
  });

  it("treats a zero total as paid", () => {
    expect(issuedInvoiceStatus({ totalMinor: 0, paidMinor: 0, dueDate: "2026-09-01" }, today)).toBe("PAID");
  });
});

describe("readinessToIssue", () => {
  it("is ready with a customer and an item", () => {
    expect(readinessToIssue({ customerId: "c1", lineCount: 1 })).toEqual({});
  });

  it("explains everything missing at once", () => {
    expect(readinessToIssue({ customerId: null, lineCount: 0 })).toEqual({
      customerId: "Choose a customer before sending.",
      lines: "Add at least one item before sending.",
    });
  });
});

describe("invoiceLinkExpiresAt", () => {
  it(`keeps the customer's link open ${INVOICE_LINK_DAYS_AFTER_DUE} days after the due date`, () => {
    expect(invoiceLinkExpiresAt("2026-10-15").toISOString()).toBe("2027-10-16T00:00:00.000Z");
  });
});

describe("invoiceLinkExpiresAt once paid", () => {
  it(`closes the link ${INVOICE_LINK_DAYS_AFTER_PAID} days after the invoice is paid`, () => {
    expect(invoiceLinkExpiresAt("2026-10-15", { paidOn: "2026-10-01" }).toISOString()).toBe("2026-12-31T00:00:00.000Z");
  });
});

describe("isPayable", () => {
  it("takes payments on sent, part-paid and overdue invoices only", () => {
    expect(["SENT", "PARTIALLY_PAID", "OVERDUE"].every((s) => isPayable(s as never))).toBe(true);
    expect(["DRAFT", "PAID", "VOID", "CANCELLED"].some((s) => isPayable(s as never))).toBe(false);
  });
});
