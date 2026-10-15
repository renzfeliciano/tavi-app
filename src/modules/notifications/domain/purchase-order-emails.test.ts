import { describe, expect, it } from "vitest";
import { type PurchaseOrderEmailInput, purchaseOrderEmail } from "./purchase-order-emails";

const input = (overrides: Partial<PurchaseOrderEmailInput> = {}): PurchaseOrderEmailInput => ({
  to: "orders@santos.example",
  businessName: "Reyes Aircon",
  businessEmail: "billing@reyes.example",
  title: "Purchase order",
  number: "PO-000001",
  supplierName: "Santos Hardware",
  total: "₱2,910.00",
  orderedOn: "Oct 1, 2026",
  expectedOn: "Oct 8, 2026",
  message: "",
  notice: "THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.",
  ...overrides,
});

describe("purchaseOrderEmail", () => {
  it("says who is ordering, the number, the total and the dates, with the notice", () => {
    const message = purchaseOrderEmail(input());
    expect(message.to).toBe("orders@santos.example");
    expect(message.subject).toBe("Purchase order PO-000001 from Reyes Aircon");
    expect(message.replyTo).toBe("billing@reyes.example");
    expect(message.text).toContain("Reyes Aircon sent Santos Hardware purchase order PO-000001 for ₱2,910.00.");
    expect(message.text).toContain("Ordered: Oct 1, 2026");
    expect(message.text).toContain("Expected by: Oct 8, 2026");
    expect(message.text).toContain("THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.");
    expect(message.html).toContain("<strong>THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.</strong>");
  });

  it("leaves out the expected date when there is none, and the notice when the market has none", () => {
    const message = purchaseOrderEmail(input({ expectedOn: null, notice: null }));
    expect(message.text).not.toContain("Expected by");
    expect(message.html).not.toContain("<strong>");
  });

  it("includes the sender's message, escaped", () => {
    const message = purchaseOrderEmail(input({ message: `Please confirm <b>today</b> & ship Tuesday.` }));
    expect(message.text).toContain("Please confirm <b>today</b> & ship Tuesday.");
    expect(message.html).not.toContain("<b>");
    expect(message.html).toContain("&lt;b&gt;today&lt;/b&gt; &amp; ship Tuesday.");
  });

  it("escapes names that contain markup", () => {
    const message = purchaseOrderEmail(input({ supplierName: "<script>x</script>", businessName: `A "B" & C` }));
    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("&amp; C");
  });

  it("leaves out the reply-to when the business has no email", () => {
    expect(purchaseOrderEmail(input({ businessEmail: null }))).not.toHaveProperty("replyTo");
  });

  it("does not claim a PDF is attached", () => {
    expect(purchaseOrderEmail(input()).text.toLowerCase()).not.toContain("attached");
  });
});
