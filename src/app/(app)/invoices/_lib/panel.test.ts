import { describe, expect, it } from "vitest";
import type { InvoiceHeader } from "@/modules/invoices";
import { invoicePanel } from "./panel";

const customerSnapshot = { displayName: "Juan Dela Cruz", company: null, email: "juan@example.com", phone: null, addressLines: [], taxId: null };

const invoice = (over: Partial<InvoiceHeader> = {}): InvoiceHeader =>
  ({
    status: "SENT",
    customerId: "c1",
    customerSnapshot,
    sourceQuoteId: null,
    issueDate: "2026-10-01",
    dueDate: "2026-10-20",
    sentAt: new Date("2026-10-01T01:00:00Z"),
    viewedAt: null,
    editedAt: null,
    voidedAt: null,
    voidReason: null,
    cancelledAt: null,
    cancelReason: null,
    ...over,
  }) as InvoiceHeader;

const options = { today: "2026-10-15", locale: "en-US", timezone: "Asia/Manila", quoteTitle: "Quotation" };
// The space before AM/PM is a narrow no-break space in newer ICU data; compare as plain spaces.
const plain = (text: string | undefined) => text?.replace(/\s/g, " ");

describe("a billing statement's side panel", () => {
  it("shows who it was issued to, linked to their record", () => {
    expect(invoicePanel(invoice(), options).customer).toEqual({
      name: "Juan Dela Cruz",
      company: null,
      email: "juan@example.com",
      phone: null,
      href: "/customers/c1",
    });
  });

  it("shows the date and when it is due, and how soon", () => {
    expect(invoicePanel(invoice(), options).facts).toEqual([
      { key: "date", label: "Date", value: "Oct 1, 2026" },
      { key: "due", label: "Due date", value: "Oct 20, 2026", note: "in 5 days" },
    ]);
  });

  it.each(["SENT", "PARTIALLY_PAID", "OVERDUE"] as const)("says how overdue it is, in the danger tone, while it is %s and past due", (status) => {
    const due = invoicePanel(invoice({ status, dueDate: "2026-10-12" }), options).facts[1];
    expect(due).toMatchObject({ note: "3 days overdue", danger: true });
  });

  it("says how soon it is due, but not in the danger tone, while the due date is still ahead", () => {
    const due = invoicePanel(invoice(), options).facts[1];

    expect(due).toMatchObject({ note: "in 5 days" });
    expect(due).not.toHaveProperty("danger");
  });

  it.each(["PAID", "VOID", "CANCELLED"] as const)("has no due-date note once it is %s, whatever the date", (status) => {
    const due = invoicePanel(invoice({ status, dueDate: "2026-10-01" }), options).facts[1];
    expect(due).toEqual({ key: "due", label: "Due date", value: "Oct 1, 2026" });
  });

  it("lists what happened to it, oldest first, even when an edit is dated before the customer opened it", () => {
    const events = invoicePanel(
      invoice({
        sentAt: new Date("2026-10-01T01:00:00Z"),
        viewedAt: new Date("2026-10-03T06:30:00Z"),
        editedAt: new Date("2026-10-02T02:00:00Z"),
      }),
      options,
    ).events;
    expect(events.map((event) => event.label)).toEqual(["Sent", "Updated", "Opened by the customer"]);
    expect(plain(events[0]?.on)).toBe("Oct 1, 2026, 9:00 AM");
  });

  it("leaves out what has not happened", () => {
    expect(invoicePanel(invoice({ sentAt: null }), options).events).toEqual([]);
  });

  it("gives the reason it was voided, or cancelled, under the event", () => {
    const voided = invoicePanel(
      invoice({ status: "VOID", voidedAt: new Date("2026-10-05T03:00:00Z"), voidReason: "Wrong unit price" }),
      options,
    ).events.at(-1);
    expect(voided).toMatchObject({ label: "Voided", detail: "Wrong unit price" });

    const cancelled = invoicePanel(
      invoice({ status: "CANCELLED", cancelledAt: new Date("2026-10-05T03:00:00Z"), cancelReason: "Job called off" }),
      options,
    ).events.at(-1);
    expect(cancelled).toMatchObject({ label: "Cancelled", detail: "Job called off" });
  });

  it("links back to the quotation it was made from, in the business's own word for it", () => {
    expect(invoicePanel(invoice({ sourceQuoteId: "q1" }), options).related).toEqual([
      { key: "quote", label: "From the approved quotation", href: "/quotes/q1" },
    ]);
    expect(invoicePanel(invoice(), options).related).toEqual([]);
  });

  it("does not link to a customer record that is gone", () => {
    expect(invoicePanel(invoice({ customerId: null }), options).customer?.href).toBeNull();
  });
});
