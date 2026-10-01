import { describe, expect, it } from "vitest";
import { paymentAcknowledgementEmail } from "./payment-emails";

const base = {
  to: "juan@example.com",
  businessName: "Santos Aircon",
  businessEmail: "billing@santos.example",
  receiptTitle: "Payment acknowledgement",
  receiptNumber: "REC-000001",
  documentName: "Billing statement INV-000001",
  received: "₱1,500.00",
  withheld: null,
  paidOn: "Oct 1, 2026",
  balance: "₱500.00",
  notice: "THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.",
  disclaimer: "Not a BIR official receipt.",
};

describe("paymentAcknowledgementEmail", () => {
  it("thanks the customer from the business, with the amount, receipt number and what's left", () => {
    const email = paymentAcknowledgementEmail(base);
    expect(email).toMatchObject({
      to: "juan@example.com",
      subject: "Payment received: Billing statement INV-000001",
      senderName: "Santos Aircon via Tavi",
      replyTo: "billing@santos.example",
    });
    for (const text of ["₱1,500.00", "REC-000001", "Oct 1, 2026", "Balance remaining: ₱500.00", "Not a BIR official receipt."]) {
      expect(email.text).toContain(text);
    }
    expect(email.html).toContain("<strong>THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.</strong>");
  });

  it("says when it's paid in full, and shows tax withheld", () => {
    const email = paymentAcknowledgementEmail({
      ...base,
      balance: null,
      withheld: { label: "Tax withheld (BIR Form 2307)", amount: "₱60.00" },
    });
    expect(email.text).toContain("Paid in full. Thank you!");
    expect(email.text).toContain("Tax withheld (BIR Form 2307): ₱60.00");
  });
});
