import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Saves the home page in light and dark at desktop and phone width
// (the two projects) to test-results/home/, to look at. The page itself is
// checked for accessibility and overflow in smoke.spec.ts; this one only checks
// the pieces that make it read well, so a picture is never taken of a broken page.

test.skip(!!process.env.CI, "pictures are for a person to look at");

const PICTURES = "test-results/home";

for (const scheme of ["light", "dark"] as const) {
  test(`home page in the ${scheme} theme`, async ({ page }, testInfo) => {
    // The stamp animates in; reduced motion shows the finished sheet.
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1, name: "Create. Send. Get paid." })).toBeVisible();
    await expect(page.getByRole("figure")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    mkdirSync(PICTURES, { recursive: true });
    await page.screenshot({ path: `${PICTURES}/${testInfo.project.name}-${scheme}.png`, fullPage: true });
  });
}
