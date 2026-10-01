import { describe, expect, it } from "vitest";
import { DELIVERY_LIMITS, parseDelivery } from "./delivery";

// The send dialog's choice arrives from the browser as-is, so the server
// checks its shape and limits itself (§I) rather than trusting the form.
describe("parseDelivery", () => {
  it("passes a link delivery through with no email", () => {
    expect(parseDelivery({ mode: "link" })).toEqual({ ok: true, email: null });
  });

  it("trims and lowercases the address and keeps the message", () => {
    expect(parseDelivery({ mode: "email", to: "  Juan@Example.COM ", message: "Hi Juan,\n\nHere it is." })).toEqual({
      ok: true,
      email: { to: "juan@example.com", message: "Hi Juan,\n\nHere it is." },
    });
  });

  it("asks for a valid address next to the field", () => {
    expect(parseDelivery({ mode: "email", to: "juan@", message: "" })).toEqual({
      ok: false,
      errors: { emailTo: "Enter a valid email address." },
    });
    const long = `${"a".repeat(DELIVERY_LIMITS.emailTo)}@example.com`;
    expect(parseDelivery({ mode: "email", to: long, message: "" })).toEqual({
      ok: false,
      errors: { emailTo: "Enter a valid email address." },
    });
  });

  it("accepts a message at the limit and refuses one past it", () => {
    const atLimit = "x".repeat(DELIVERY_LIMITS.message);
    expect(parseDelivery({ mode: "email", to: "juan@example.com", message: atLimit })).toMatchObject({ ok: true });
    expect(parseDelivery({ mode: "email", to: "juan@example.com", message: `${atLimit}x` })).toEqual({
      ok: false,
      error: "Shorten the message. Use 2,000 characters or fewer.",
    });
  });

  it.each([
    ["nothing", undefined],
    ["null", null],
    ["an unknown mode", { mode: "sms", to: "0917" }],
    ["an address that isn't text", { mode: "email", to: 42, message: "" }],
    ["a message that isn't text", { mode: "email", to: "juan@example.com", message: { html: "<b>" } }],
  ])("refuses %s without throwing", (_label, raw) => {
    expect(parseDelivery(raw)).toEqual({ ok: false, error: "Choose how to send it, then try again." });
  });
});
