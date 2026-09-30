import { describe, expect, it } from "vitest";
import { chooseEmailTransport } from "./transport-selection";

const smtp = { SMTP_USER: "tavi.notify@gmail.com", SMTP_PASSWORD: "app password", EMAIL_FROM: "Tavi <tavi.notify@gmail.com>" };

describe("chooseEmailTransport", () => {
  it("prefers Resend when it's configured (a verified domain)", () => {
    expect(chooseEmailTransport({ ...smtp, RESEND_API_KEY: "re_1" })).toBe("resend");
  });

  it("uses Gmail SMTP when an account and sender are set (free tier, D11)", () => {
    expect(chooseEmailTransport(smtp)).toBe("smtp");
  });

  it("falls back to the console sender when nothing is configured", () => {
    expect(chooseEmailTransport({})).toBe("console");
    expect(chooseEmailTransport({ SMTP_USER: "a@b.co" })).toBe("console");
    expect(chooseEmailTransport({ RESEND_API_KEY: "re_1" })).toBe("console");
  });
});
