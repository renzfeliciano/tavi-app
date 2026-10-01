import { type Browser, expect, test } from "@playwright/test";
import { OWNER_STATE } from "../playwright.config";
import { SCREENS } from "./screens";

// The device matrix (§59, proposal §J): small phone, large phone and tablet,
// all touch, on every signed-in screen. Pixel 7 and desktop are the projects
// themselves. Checks the two rules a screen can silently break on a size we
// don't look at every day: no sideways scroll, and touch targets ≥ 44px tall
// (DESIGN.md "Touch"). Inline links inside a sentence are exempt (WCAG 2.5.8),
// and so are the clear/open buttons inside a 44px combobox field, whose whole
// field is the target; fields are sized by their components (`pointer-coarse:h-11`).
const DEVICES = [
  { name: "small phone", viewport: { width: 320, height: 640 } },
  { name: "large phone", viewport: { width: 430, height: 932 } },
  { name: "tablet", viewport: { width: 768, height: 1024 } },
] as const;

/** Visible links and buttons shorter than 44px, as "text (w×h)". */
function smallTargets() {
  const found: string[] = [];
  for (const el of document.querySelectorAll<HTMLElement>("a[href], button, [role=button], select, summary")) {
    if (el.closest('.sr-only, p, [data-slot="combobox-field"]')) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1 || getComputedStyle(el).visibility === "hidden") continue;
    if (rect.height < 44) {
      const name = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40);
      found.push(`${name} (${Math.round(rect.width)}×${Math.round(rect.height)})`);
    }
  }
  return found;
}

async function touchContext(browser: Browser, viewport: { width: number; height: number }) {
  return browser.newContext({ storageState: OWNER_STATE, viewport, isMobile: viewport.width < 600, hasTouch: true });
}

// It sets its own viewports, so it runs once (in the desktop project).
test.skip(({ isMobile }) => isMobile, "Runs its own devices");

for (const device of DEVICES) {
  test(`${device.name} (${device.viewport.width}px): no sideways scroll, touch targets ≥ 44px`, async ({ browser }) => {
    test.setTimeout(test.info().timeout * 4);
    const context = await touchContext(browser, device.viewport);
    const page = await context.newPage();
    for (const path of SCREENS) {
      await page.goto(path);
      await expect(page.locator("#main")).toBeVisible();
      expect.soft(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${path} scrolls sideways`).toBe(false);
      expect.soft(await page.evaluate(smallTargets), `${path} has small touch targets`).toEqual([]);
    }
    await context.close();
  });
}
