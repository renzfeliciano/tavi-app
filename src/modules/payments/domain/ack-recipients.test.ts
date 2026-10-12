import { describe, expect, it } from "vitest";
import { MAX_ACK_RECIPIENTS, parseAckRecipients } from "./ack-recipients";

describe("parseAckRecipients", () => {
  it("accepts none", () => {
    expect(parseAckRecipients([])).toEqual({ ok: true, emails: [] });
    expect(parseAckRecipients(["  ", ""])).toEqual({ ok: true, emails: [] });
  });

  it("trims, lower-cases and de-duplicates", () => {
    expect(parseAckRecipients([" Juan@Example.com ", "juan@example.com", "ana@example.com"])).toEqual({
      ok: true,
      emails: ["juan@example.com", "ana@example.com"],
    });
  });

  it("rejects an invalid address and names it", () => {
    expect(parseAckRecipients(["ana@example.com", "nope"])).toEqual({ ok: false, error: `"nope" isn't a valid email address.` });
  });

  it("caps the number of people", () => {
    const many = Array.from({ length: MAX_ACK_RECIPIENTS + 1 }, (_, i) => `p${i}@example.com`);
    expect(parseAckRecipients(many)).toMatchObject({ ok: false });
    expect(parseAckRecipients(many.slice(0, MAX_ACK_RECIPIENTS))).toMatchObject({ ok: true });
  });
});
