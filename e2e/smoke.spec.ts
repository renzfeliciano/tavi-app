import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("holding page", () => {
  test("renders the TAVI brand", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Tavi/);
    await expect(
      page.getByRole("heading", { level: 1, name: "TAVI" }),
    ).toBeVisible();
  });

  test("has no WCAG 2.2 AA violations", async ({ page }) => {
    await page.goto("/");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("does not scroll horizontally", async ({ page }) => {
    await page.goto("/");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
});
