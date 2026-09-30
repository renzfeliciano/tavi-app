import { describe, expect, it } from "vitest";
import { documentLinkEmail } from "./document-emails";

const base = {
  to: "juan@example.com",
  businessName: "Santos Aircon",
  businessEmail: "billing@santos.example",
  title: "Quotation",
  number: "QUO-000012",
  total: "₱3,450.00",
  dueLine: "Valid until Oct 15, 2026",
  message: "Hi Juan,\nHere's the quote for Saturday's cleaning.",
  url: "https://tavi.example/q/abc123",
  action: "View and approve",
};

describe("documentLinkEmail", () => {
  it("comes from the business, replies go to the business, and the link is the point", () => {
    const email = documentLinkEmail(base);
    expect(email).toMatchObject({
      to: "juan@example.com",
      subject: "Quotation QUO-000012 from Santos Aircon",
      senderName: "Santos Aircon via Tavi",
      replyTo: "billing@santos.example",
    });
    expect(email.text).toContain("Here's the quote for Saturday's cleaning.");
    expect(email.text).toContain("₱3,450.00");
    expect(email.text).toContain("Valid until Oct 15, 2026");
    expect(email.text).toContain("https://tavi.example/q/abc123");
    expect(email.html).toContain('href="https://tavi.example/q/abc123"');
  });

  it("escapes what the business typed", () => {
    const email = documentLinkEmail({ ...base, message: "<script>alert(1)</script>", businessName: "A & B" });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("A &amp; B");
  });

  it("has no Reply-To when the business has no email", () => {
    expect(documentLinkEmail({ ...base, businessEmail: null }).replyTo).toBeUndefined();
  });
});
