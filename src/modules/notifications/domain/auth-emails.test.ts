import { describe, expect, it } from "vitest";
import { passwordResetEmail, verifyEmailEmail } from "./auth-emails";

const url = "https://app.tavi.example/api/auth/verify-email?token=abc&callbackURL=%2Fdashboard";

describe("verifyEmailEmail", () => {
  it("addresses the user and carries the link in text and HTML", () => {
    const email = verifyEmailEmail({ to: "maria@example.com", name: "Maria", url });
    expect(email.to).toBe("maria@example.com");
    expect(email.subject).toBe("Verify your email for Tavi");
    expect(email.text).toContain(url);
    expect(email.html).toContain(url.replaceAll("&", "&amp;"));
    expect(email.text).toContain("Hi Maria");
  });

  it("escapes user-controlled names in the HTML", () => {
    const email = verifyEmailEmail({ to: "x@example.com", name: '<img src=x onerror="alert(1)">', url });
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;img");
  });
});

describe("passwordResetEmail", () => {
  it("explains the link expires and is safe to ignore", () => {
    const email = passwordResetEmail({ to: "maria@example.com", name: "Maria", url });
    expect(email.subject).toBe("Reset your Tavi password");
    expect(email.text).toContain(url);
    expect(email.text).toMatch(/30 minutes/);
    expect(email.text).toMatch(/ignore this email/);
  });
});
