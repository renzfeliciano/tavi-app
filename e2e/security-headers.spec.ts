import { expect, test } from "@playwright/test";

test.describe("security headers (§I)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("pages carry a per-request nonce CSP and the hardening headers", async ({ page }) => {
    const first = await page.goto("/sign-in");
    const second = await page.goto("/sign-in");
    const csp1 = first?.headers()["content-security-policy"] ?? "";
    const csp2 = second?.headers()["content-security-policy"] ?? "";

    expect(csp1).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(csp1).toContain("frame-ancestors 'none'");
    expect(csp1).not.toBe(csp2); // fresh nonce every request

    const headers = second!.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("the policy blocks nothing the app itself needs", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/Content Security Policy|Refused to/i.test(message.text())) violations.push(message.text());
    });

    await page.goto("/sign-up");
    // Client-side React must be running: the password toggle is interactive.
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.getByRole("button", { name: "Hide password" })).toBeVisible();

    expect(violations).toEqual([]);
  });
});
