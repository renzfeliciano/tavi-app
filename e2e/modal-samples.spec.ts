import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { SAMPLES } from "../src/app/dev/modals/sample-list";

// The development page /dev/modals shows one sample of every kind of modal
// (DESIGN.md, "Modals"). This opens each one in light and dark, at desktop and
// phone width (the two projects), checks it sits where the design says, has no
// WCAG 2.2 AA violations, and saves a picture to test-results/modal-samples/.
// The page is development-only, so a production build (CI) skips it.

test.skip(!!process.env.CI, "/dev/modals does not exist in a production build");

const PICTURES = "test-results/modal-samples";

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} theme`, () => {
    for (const sample of SAMPLES) {
      test(`${sample.id} modal sits right, reads well and is accessible`, async ({ page }, testInfo) => {
        // Reduced motion shows the modal at once, so the picture and the contrast check never catch a half-faded frame.
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
        await page.goto(`/dev/modals?sample=${sample.id}`);

        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        const footer = dialog.locator('[data-slot="dialog-footer"]');
        await expect(footer.locator(".mascot")).toHaveAttribute("data-expression", sample.mascot);

        // Where it sits: a bottom sheet across a phone, a centred card from sm up.
        const viewport = page.viewportSize();
        const box = await dialog.boundingBox();
        if (!viewport || !box) throw new Error("no viewport or dialog box");
        expect(box.x).toBeGreaterThanOrEqual(-0.5);
        expect(box.y).toBeGreaterThanOrEqual(-0.5);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 0.5);
        if (viewport.width < 640) {
          expect(Math.abs(box.y + box.height - viewport.height), "a phone modal rests on the bottom edge").toBeLessThan(1);
          expect(Math.abs(box.width - viewport.width), "and spans the screen").toBeLessThan(1);
        } else {
          expect(Math.abs(box.x + box.width / 2 - viewport.width / 2), "a desktop modal is centred").toBeLessThan(1);
          expect(Math.abs(box.y + box.height / 2 - viewport.height / 2), "both ways").toBeLessThan(1);
        }

        // The buttons are always reachable, even when the content is long.
        for (const button of await footer.getByRole("button").all()) await expect(button).toBeInViewport({ ratio: 1 });
        if (sample.id === "long" && viewport.height <= 800) {
          const body = dialog.locator('[data-slot="dialog-body"]');
          expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight), "only the body scrolls").toBe(true);
        }

        // Nothing makes the page scroll sideways.
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

        const results = await new AxeBuilder({ page })
          .include('[role="dialog"]')
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(results.violations).toEqual([]);

        mkdirSync(PICTURES, { recursive: true });
        await page.screenshot({ path: `${PICTURES}/${testInfo.project.name}-${scheme}-${sample.id}.png` });
      });
    }
  });
}
