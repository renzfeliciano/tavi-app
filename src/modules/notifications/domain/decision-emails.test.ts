import { describe, expect, it } from "vitest";
import { quoteDecisionEmail } from "./decision-emails";

const base = {
  to: "maria@santos.example",
  customerName: "Juan Dela Cruz",
  title: "Quotation",
  number: "QUO-000012",
  total: "₱3,450.00",
  url: "https://tavi.example/quotes/7f0c",
};

describe("quoteDecisionEmail", () => {
  it("tells the business who approved which quote, and links to it", () => {
    const email = quoteDecisionEmail({ ...base, decision: { kind: "approve", name: "Juan D. Cruz" } });
    expect(email.to).toBe("maria@santos.example");
    expect(email.subject).toBe("Juan Dela Cruz approved Quotation QUO-000012");
    expect(email.text).toContain("Approved by Juan D. Cruz");
    expect(email.text).toContain("₱3,450.00");
    expect(email.text).toContain("https://tavi.example/quotes/7f0c");
    expect(email.html).toContain('href="https://tavi.example/quotes/7f0c"');
  });

  it("passes on a decline's reason, escaped in the HTML", () => {
    const email = quoteDecisionEmail({ ...base, decision: { kind: "reject", reason: "Too <b>expensive</b>" } });
    expect(email.subject).toBe("Juan Dela Cruz declined Quotation QUO-000012");
    expect(email.text).toContain("Reason: Too <b>expensive</b>");
    expect(email.html).toContain("Too &lt;b&gt;expensive&lt;/b&gt;");
  });

  it("leaves the reason out when none was given", () => {
    const email = quoteDecisionEmail({ ...base, decision: { kind: "reject", reason: null } });
    expect(email.text).not.toContain("Reason");
  });
});
