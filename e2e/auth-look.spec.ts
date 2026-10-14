import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

// The sign-in pages' side panel: on a wide screen the Stamp sits above a paper slip of the job's three moments, and
// the form column has the same width with or without it; on a phone the panel is left out and nothing overflows.
test.use({ storageState: { cookies: [], origins: [] } });

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();

for (const path of ["/sign-in", "/sign-up"]) {
  test(`${path} on a wide screen shows the slip beside the form`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(path);
    const slip = page.getByText("From quote to paid");
    await expect(slip).toBeVisible();
    const form = await page.getByRole("main").boundingBox();
    const panel = await slip.boundingBox();
    if (!form || !panel) throw new Error("not on screen");
    expect(panel.x + panel.width).toBeLessThan(form.x);
    expect((await axe(page)).violations).toEqual([]);
  });

  test(`${path} on a phone leaves the slip out and fits the screen`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByText("From quote to paid")).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    expect((await axe(page)).violations).toEqual([]);
  });
}
