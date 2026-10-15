import { describe, expect, it } from "vitest";
import { type ReceiptEmailInput, receiptEmail } from "./receipt-emails";

const input = (overrides: Partial<ReceiptEmailInput> = {}): ReceiptEmailInput => ({
  to: "maria@example.com",
  businessName: "Santos Aircon",
  businessEmail: "billing@santos.example",
  receiptTitle: "Collection receipt",
  receiptNumber: "REC-000001",
  payerName: "Maria Santos",
  purpose: "Reimbursement of fuel",
  received: "₱1,500.00",
  receivedOn: "Oct 1, 2026",
  details: [{ label: "Method", value: "Cash" }],
  notice: "THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.",
  disclaimer: "Not a BIR official receipt.",
  ...overrides,
});

describe("receiptEmail", () => {
  it("says who received what, for what, with the number, notice and disclaimer", () => {
    const message = receiptEmail(input());
    expect(message.to).toBe("maria@example.com");
    expect(message.subject).toBe("Collection receipt REC-000001 from Santos Aircon");
    expect(message.replyTo).toBe("billing@santos.example");
    expect(message.text).toContain("Santos Aircon received ₱1,500.00 from Maria Santos for Reimbursement of fuel.");
    expect(message.text).toContain("Method: Cash");
    expect(message.text).toContain("THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.");
    expect(message.text).toContain("Not a BIR official receipt.");
    expect(message.html).toContain("<strong>THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.</strong>");
  });

  it("escapes names and purposes that contain markup", () => {
    const message = receiptEmail(input({ payerName: `<b>"Maria"</b> & co`, purpose: "<script>x</script>" }));
    expect(message.html).not.toContain("<b>");
    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("&lt;b&gt;");
    expect(message.html).toContain("&amp; co");
  });

  it("leaves out the reply-to when the business has no email", () => {
    expect(receiptEmail(input({ businessEmail: null }))).not.toHaveProperty("replyTo");
  });
});
