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

  describe("payment QR codes", () => {
    const paymentQrs = [
      { label: "GCash", imageUrl: "https://tavi.example/i/abc123/qr/0" },
      { label: "Maya <b>", imageUrl: "https://tavi.example/i/abc123/qr/1" },
    ];

    it("shows each QR as an image from the link, labelled, with alt text", () => {
      const { html } = documentLinkEmail({ ...base, paymentQrs });
      expect(html).toContain('<img src="https://tavi.example/i/abc123/qr/0" alt="GCash QR code"');
      expect(html).toContain('src="https://tavi.example/i/abc123/qr/1"');
      expect(html).toContain("Scan to pay");
    });

    it("escapes the labels the business typed", () => {
      const { html } = documentLinkEmail({ ...base, paymentQrs });
      expect(html).not.toContain("<b>");
      expect(html).toContain("Maya &lt;b&gt;");
    });

    it("points the plain-text version at the page, since text can't show a QR", () => {
      const { text } = documentLinkEmail({ ...base, paymentQrs });
      expect(text).toContain("GCash");
      expect(text).toContain("QR");
      expect(text).not.toContain("/qr/0");
    });

    it("adds nothing when there are none", () => {
      const email = documentLinkEmail(base);
      expect(email.html).not.toContain("Scan to pay");
      expect(email.text).not.toContain("QR");
    });
  });

  it("signs off with the TAVI wordmark, loaded from the app the link points to", () => {
    const { html } = documentLinkEmail(base);
    expect(html).toContain('src="https://tavi.example/icons/tavi-email-wordmark.png"');
    expect(html).toContain('alt="Tavi"');
  });
});
