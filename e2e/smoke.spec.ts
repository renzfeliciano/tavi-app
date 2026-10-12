import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("home page", () => {
  test("renders the TAVI brand", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Tavi/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Create. Send. Get paid." }),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: "TAVI" }).first()).toBeVisible();
  });

  // The sample quotation's stamp fades in (260ms delay, 320ms). Axe would measure it
  // mid-fade and see a pale colour that never rests on screen, so these two checks
  // run with reduced motion, which shows the finished page at once.
  test("has no WCAG 2.2 AA violations", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("has no WCAG 2.2 AA violations in the dark theme either", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.goto("/");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  // 360px is the most common Android width in the Philippines; 320px is the narrowest we support.
  for (const width of [320, 360]) {
    test(`fits a ${width}px-wide phone`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await page.goto("/");

      await expect(page.getByRole("link", { name: "Sign in" })).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }

  // The home's reveals are scroll-driven: a block below the fold waits, then arrives. It must end fully visible.
  test("with motion on, the closing card arrives fully when scrolled to", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");

    const heading = page.getByRole("heading", { level: 2, name: /^Send your first .+ today$/ });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeInViewport();
    await expect
      .poll(() => heading.evaluate((el) => getComputedStyle(el.closest(".home-cta") as Element).opacity))
      .toBe("1");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("does not scroll horizontally", async ({ page }) => {
    await page.goto("/");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
});
