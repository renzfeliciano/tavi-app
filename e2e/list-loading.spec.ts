import { expect, type Page, test } from "@playwright/test";

// A tab, a page link or a search on a list only changes the query string, so Next
// keeps the old rows on screen and never shows loading.tsx. On a slow connection
// that looked like a dead click. These slow the server's answers down and check
// that the list's skeleton shows meanwhile (src/components/list-pending.tsx).

const SLOW_MS = 1500;

/** Holds back the answers Next's router asks for (its RSC requests) to `path`. */
async function slowAnswers(page: Page, path: string) {
  await page.route(`**${path}**`, async (route) => {
    if (route.request().headers().rsc === "1") await new Promise((resolve) => setTimeout(resolve, SLOW_MS));
    await route.continue();
  });
}

const loading = (page: Page, label: string) => page.getByRole("status").filter({ hasText: label });

test.describe("lists while a tab, page or search is loading", () => {
  test("opening a tab shows the list's skeleton, then the new rows", async ({ page }) => {
    await page.goto("/catalog?type=services");
    await expect(page.getByRole("link", { name: "Products", exact: true })).toBeVisible();
    await slowAnswers(page, "/catalog");

    await page.getByRole("link", { name: "Products", exact: true }).click();

    await expect(loading(page, "Loading products and services")).toBeVisible();
    await expect(page.getByRole("link", { name: "Products", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(loading(page, "Loading products and services")).toBeHidden();
    await expect(page).toHaveURL(/\/catalog\?type=products$/);
    await expect(page.getByRole("heading", { name: "No products yet" })).toBeVisible();
  });

  test("a search shows the skeleton and doesn't reload the page", async ({ page }) => {
    await page.goto("/catalog?type=services");
    await expect(page.getByRole("searchbox", { name: /^Search/ })).toBeVisible();
    await page.evaluate(() => Object.assign(window, { sameDocument: true }));
    await slowAnswers(page, "/catalog");

    await page.getByRole("searchbox", { name: /^Search/ }).fill("zzz");
    await page.keyboard.press("Enter");

    await expect(loading(page, "Loading products and services")).toBeVisible();
    await expect(page).toHaveURL(/\/catalog\?type=services&q=zzz$|\/catalog\?q=zzz&type=services$/);
    await expect(page.getByRole("heading", { name: "No services match “zzz”" })).toBeVisible();
    await expect(loading(page, "Loading products and services")).toBeHidden();
    expect(await page.evaluate(() => "sameDocument" in window)).toBe(true);
  });

  test("a report period shows the skeleton under its controls", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByRole("link", { name: "Last month" })).toBeVisible();
    await slowAnswers(page, "/reports");

    await page.getByRole("link", { name: "Last month" }).click();

    await expect(loading(page, "Loading reports")).toBeVisible();
    // The controls stay where they are, so the person can see which period they chose.
    await expect(page.getByRole("link", { name: "Last month" })).toHaveAttribute("aria-current", "page");
    await expect(loading(page, "Loading reports")).toBeHidden();
    await expect(page.locator("#sales-heading")).toBeVisible();
  });

  test("the dates of a report show the skeleton too", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByLabel("From", { exact: true })).toBeVisible();
    await slowAnswers(page, "/reports");

    await page.getByLabel("From", { exact: true }).fill("2026-01-01");
    await page.getByLabel("To", { exact: true }).fill("2026-01-31");
    await page.getByRole("button", { name: "Show" }).click();

    await expect(loading(page, "Loading reports")).toBeVisible();
    await expect(page).toHaveURL(/\/reports\?from=2026-01-01&to=2026-01-31$/);
    await expect(loading(page, "Loading reports")).toBeHidden();
  });
});
