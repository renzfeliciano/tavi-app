import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, type Locator, type Page, test } from "@playwright/test";
import { asVisitor, createBusiness, markEmailVerified, signUp, strongPassword, uniqueEmail } from "./helpers";

// An unpaid bill shows in Reports' unpaid section as an age bar with a legend, and while Reports loads its skeleton
// holds the card where it will land. Made-up names and numbers only. Desktop only (see ACCOUNT_CREATING_SPECS).
test.use({ storageState: { cookies: [], origins: [] }, ...asVisitor("reports-aging") });
test.describe.configure({ mode: "serial" });
test.slow();

let context: BrowserContext;
let page: Page;

const toast = (text: string | RegExp) => page.locator("[data-sonner-toast]").filter({ hasText: text });
const bar = () => page.getByRole("img", { name: /^Outstanding by age:/ });
const realCard = () => page.getByRole("heading", { name: /^Outstanding by age/ }).locator("xpath=..");

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  const email = uniqueEmail("reports-aging");
  await signUp(page, { name: "Maria Santos", email, password: strongPassword() });
  await createBusiness(page, "Santos Aircon");
  await markEmailVerified(email);
  await page.goto("/customers/new");
  await page.getByLabel("Name", { exact: true }).fill("Juan Dela Cruz");
  await page.getByRole("textbox", { name: /^Email/ }).fill("juan@example.com");
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(toast("Juan Dela Cruz added.")).toBeVisible();

  await page.goto("/invoices/new");
  await page.getByRole("combobox", { name: "Customer", exact: true }).fill("Juan");
  await page.getByRole("option", { name: /Juan Dela Cruz/ }).click();
  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByLabel("Line 1 description").fill("Aircon cleaning");
  await page.getByLabel("Price (PHP)").first().fill("2,000");
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const send = page.getByRole("dialog", { name: /^Send / });
  await send.getByLabel("Copy link").check();
  await send.getByRole("button", { name: "Mark as sent and copy link" }).click();
  await expect(toast(/is ready\. Link copied\./)).toBeVisible();
});

test.afterAll(async () => {
  await context.close();
});

test("an unpaid bill appears in the age bar and its legend", async () => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/reports");
  await expect(bar()).toBeVisible();
  const legend = page.getByRole("list", { name: "Outstanding by age" });
  await expect(legend.getByRole("listitem")).toHaveCount(5);
  await expect(legend).toContainText("₱2,000.00");
  await expect(legend).toContainText("100%");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .exclude("[data-sonner-toaster]")
    .analyze();
  expect(results.violations).toEqual([]);
});

test("on a phone the legend stays inside the card", async () => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/reports");
  await expect(bar()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  const card = await realCard().boundingBox();
  expect(card && card.x + card.width <= 375).toBe(true);
});

test("while a period loads, the skeleton holds the age card where it will land", async () => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/reports");
  const period = page.getByRole("link", { name: "Last month" });
  await expect(period).toBeVisible();
  await expect(bar()).toBeVisible();
  let slow = true;
  await page.route("**/reports**", async (route) => {
    if (slow && route.request().headers().rsc === "1") await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });

  await period.click();
  const skeleton = page.getByRole("status").filter({ hasText: "Loading reports" });
  await expect(skeleton).toBeVisible();
  // Sales and payments may be empty for the period the page ends up showing, so compare the card with the unpaid
  // section's own figures above it, not with the top of the page.
  const place = async (section: Locator) => {
    const cards = section.locator("div.grid.gap-3 > *");
    const figures = await cards.nth(0).boundingBox();
    const age = await cards.nth(1).boundingBox();
    if (!figures || !age) throw new Error("not on screen");
    return { below: age.y - (figures.y + figures.height), height: age.height, x: age.x, width: age.width };
  };
  const waiting = await place(skeleton.locator("div.mt-10").nth(2));
  await expect(skeleton).toBeHidden();
  slow = false;
  await expect(bar()).toBeVisible();
  const arrived = await place(page.locator("section[aria-labelledby=unpaid-heading]"));
  expect(Math.abs(waiting.below - arrived.below)).toBeLessThanOrEqual(2);
  expect(Math.abs(waiting.height - arrived.height)).toBeLessThanOrEqual(2);
  expect(Math.abs(waiting.x - arrived.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(waiting.width - arrived.width)).toBeLessThanOrEqual(1);
});
