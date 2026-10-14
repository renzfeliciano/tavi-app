import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { asVisitor, createBusiness, signUp, strongPassword, uniqueEmail } from "./helpers";

// Settings: each overview row says where that area stands, long pages have jump links, and the long forms keep a
// save bar in view that says whether anything is unsaved. Made-up names only. Desktop only (see ACCOUNT_CREATING_SPECS).
test.use({ storageState: { cookies: [], origins: [] }, ...asVisitor("settings-polish") });
test.describe.configure({ mode: "serial" });
test.slow();

let context: BrowserContext;
let page: Page;

const toast = (text: string) => page.locator("[data-sonner-toast]").filter({ hasText: text });
const row = (title: string) => page.getByRole("listitem").filter({ has: page.getByRole("link", { name: new RegExp(`^${title}`) }) });
const saveBar = () => page.getByRole("status").filter({ hasText: /changes/i }).locator("xpath=..");

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  await signUp(page, { name: "Maria Santos", email: uniqueEmail("settings-polish"), password: strongPassword() });
  await createBusiness(page, "Santos Aircon");
});

test.afterAll(async () => {
  await context.close();
});

test("each Settings row says where that area stands", async () => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/settings");
  await expect(row("Business profile")).toContainText("Add your TIN");
  await expect(row("Team")).toContainText("Just you");
  await expect(row("Security")).toContainText("1 device");
  await expect(row("Tax rates")).toContainText(/rate/);
  await expect(row("Document numbers").getByTestId("row-state")).toHaveCount(0);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("jump links take you to a section of the business profile", async () => {
  await page.goto("/settings/business");
  const nav = page.getByRole("navigation", { name: "On this page" });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Notes and terms" }).click();
  await expect(page).toHaveURL(/#terms$/);
  await expect(page.getByRole("heading", { name: "Notes, terms and payment" })).toBeInViewport();
});

test("the save bar stays in view and follows the form's state", async () => {
  await page.goto("/settings/business");
  const bar = saveBar();
  // It is in view from the top of a long page, not only at the end of the form.
  await expect(bar).toBeInViewport();
  await expect(bar).toContainText("No changes yet");
  await page.getByLabel("Business name").fill("Santos Aircon Services");
  await expect(bar).toContainText("Unsaved changes");
  await bar.getByRole("button", { name: "Save changes" }).click();
  await expect(toast("Business profile saved.")).toBeVisible();
  await expect(saveBar()).toContainText("All changes saved");
  await page.getByLabel("Business name").fill("Santos Aircon Plus");
  await expect(saveBar()).toContainText("Unsaved changes");
});

test("on a phone the save bar sits above the tab bar", async () => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto("/settings/business");
  const box = await saveBar().boundingBox();
  if (!box) throw new Error("save bar not on screen");
  expect(box.y + box.height).toBeLessThanOrEqual(700 - 72 + 1);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test("while the business profile loads, its skeleton holds the save bar's size", async () => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/settings");
  const link = page.getByRole("link", { name: /^Business profile/ });
  await expect(link).toBeVisible();
  // Resting on the link lets the router fetch the page's loading screen, as it does for a person about to click.
  await link.hover();
  await page.waitForLoadState("networkidle");
  let slow = true;
  await page.route("**/settings/business**", async (route) => {
    // Hold back the page's own answer, not the router's prefetch of the loading screen that comes first.
    const { rsc, "next-router-prefetch": prefetch } = route.request().headers();
    if (slow && rsc === "1" && !prefetch) await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });

  await link.click();
  const skeleton = page.getByRole("status").filter({ hasText: "Loading business profile" });
  await expect(skeleton).toBeVisible();
  const waiting = await skeleton.locator("div.shadow-sm").last().boundingBox();
  const waitingChips = await skeleton.locator("div.mt-6").first().boundingBox();
  await expect(skeleton).toBeHidden();
  slow = false;
  const jump = page.getByRole("navigation", { name: "On this page" });
  await expect(jump).toBeVisible();
  await expect(saveBar()).toBeVisible();
  const arrived = await saveBar().boundingBox();
  const arrivedChips = await jump.boundingBox();
  if (!waiting || !arrived || !waitingChips || !arrivedChips) {
    throw new Error(`not on screen: ${JSON.stringify({ waiting, arrived, waitingChips, arrivedChips })}`);
  }
  expect(Math.abs(waiting.height - arrived.height)).toBeLessThanOrEqual(2);
  expect(Math.abs(waiting.width - arrived.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(waiting.x - arrived.x)).toBeLessThanOrEqual(1);
  // The jump links keep their place under the header, in a single line on a wide screen.
  expect(Math.abs(waitingChips.y - arrivedChips.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(waitingChips.height - arrivedChips.height)).toBeLessThanOrEqual(2);
});

test("the team shows each person with their initials and role, and its skeleton holds the row's size", async () => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/settings/team");
  const people = page.getByRole("region", { name: "People" });
  const owner = people.getByRole("listitem").first();
  await expect(owner).toContainText("MS");
  await expect(owner).toContainText("Maria Santos");
  await expect(owner.getByText("Owner", { exact: true })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);

  await page.goto("/settings");
  const link = page.getByRole("link", { name: /^Team/ });
  await expect(link).toBeVisible();
  // Resting on the link lets the router fetch the page's loading screen, as it does for a person about to click.
  await link.hover();
  await page.waitForLoadState("networkidle");
  let slow = true;
  await page.route("**/settings/team**", async (route) => {
    // Hold back the page's own answer, not the router's prefetch of the loading screen that comes first.
    const { rsc, "next-router-prefetch": prefetch } = route.request().headers();
    if (slow && rsc === "1" && !prefetch) await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });

  await link.click();
  const skeleton = page.getByRole("status").filter({ hasText: "Loading team" });
  await expect(skeleton).toBeVisible();
  const waiting = await skeleton.locator("div.divide-y > div").first().boundingBox();
  await expect(skeleton).toBeHidden();
  slow = false;
  await expect(owner).toBeVisible();
  const arrived = await owner.boundingBox();
  if (!waiting || !arrived) throw new Error("not on screen");
  expect(Math.abs(waiting.y - arrived.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(waiting.height - arrived.height)).toBeLessThanOrEqual(2);
  expect(Math.abs(waiting.x - arrived.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(waiting.width - arrived.width)).toBeLessThanOrEqual(1);
});
