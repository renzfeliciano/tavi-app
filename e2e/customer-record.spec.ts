import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { asVisitor, createBusiness, markEmailVerified, signUp, strongPassword, tableRows, uniqueEmail } from "./helpers";

// A customer as the business sees them: what they owe on the Customers list, and on their own page the
// money, their latest quotations and billing statements, and a way to start a new one with them already
// chosen. One fresh business with real documents (written, sent and part-paid through the screens), so the
// figures are the ones the app computes. Desktop only (see ACCOUNT_CREATING_SPECS in playwright.config.ts).
test.use({ storageState: { cookies: [], origins: [] }, ...asVisitor("customer-record") });
test.describe.configure({ mode: "serial" });
test.slow();

let page: Page;
let juanId: string;

const axe = (p: Page) =>
  new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
const toast = (text: string | RegExp) => page.locator("[data-sonner-toast]").filter({ hasText: text });
const rows = () => tableRows(page, "Customer list");
const summary = () => page.getByRole("region", { name: "Customer summary" });
const quotations = () => page.getByRole("region", { name: "Quotations", exact: true });
const statements = () => page.getByRole("region", { name: "Billing statements", exact: true });
const customerBox = () => page.getByRole("combobox", { name: "Customer", exact: true });

/** A calendar date this many days ago, so a statement is a known number of days past due whatever day this runs. */
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  const email = uniqueEmail("customer-record");
  await signUp(page, { name: "Maria Santos", email, password: strongPassword() });
  await createBusiness(page, "Santos Aircon");
  await markEmailVerified(email);
  const customers: [name: string, address: string][] = [
    ["Juan Dela Cruz", "juan@example.com"],
    ["Ana Reyes", "ana@example.com"],
  ];
  for (const [name, address] of customers) {
    await page.goto("/customers/new");
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByRole("textbox", { name: /^Email/ }).fill(address);
    await page.getByRole("button", { name: "Add customer" }).click();
    await expect(toast(`${name} added.`)).toBeVisible();
    await expect(page).toHaveURL(/\/customers\/[0-9a-f-]{36}$/);
    if (name === "Juan Dela Cruz") juanId = page.url().match(/\/customers\/([0-9a-f-]{36})$/)?.[1] ?? "";
  }
  expect(juanId).not.toBe("");
});

test.afterAll(async () => {
  await page.context().close();
});

test("a customer nothing was billed to owes nothing and has had no activity", async () => {
  await page.goto("/customers");
  const ana = rows().filter({ hasText: "Ana Reyes" });
  await expect(ana).toContainText("Nothing owed");
  await expect(ana).toContainText("No activity yet");

  await ana.getByRole("link", { name: /Ana Reyes/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ana Reyes" })).toBeVisible();
  await expect(summary()).toContainText("Nothing owed");
  await expect(summary()).toContainText("No billing statements yet");
  await expect(summary()).toContainText("Nothing paid yet");
  await expect(quotations().getByText("No quotations yet.")).toBeVisible();
  await expect(statements().getByText("No billing statements yet.")).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);
});

test("from a customer's page, a new billing statement opens with them already chosen", async () => {
  await page.goto(`/customers/${juanId}`);
  await statements().getByRole("link", { name: "New billing statement" }).click();
  await expect(page).toHaveURL(new RegExp(`/invoices/new\\?customer=${juanId}$`));
  await expect(customerBox()).toHaveValue("Juan Dela Cruz");

  // Issued three weeks ago and due ten days ago: past due, whatever day this runs.
  await page.getByLabel("Date", { exact: true }).fill(daysAgo(24));
  await page.getByLabel("Due date").fill(daysAgo(10));
  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByLabel("Line 1 description").fill("Aircon cleaning");
  await page.getByLabel("Price (PHP)").first().fill("1,500");
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}$/);

  await page.getByRole("button", { name: "Send", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /^Send / });
  await dialog.getByRole("button", { name: "Send email" }).click();
  await expect(toast("Billing statement INV-000001 sent to juan@example.com.")).toBeVisible();
});

test("their page then shows what they owe, and the list shows it beside them", async () => {
  await page.goto(`/customers/${juanId}`);
  await expect(summary()).toContainText("₱1,500.00");
  await expect(summary()).toContainText("₱1,500.00 overdue");
  await expect(summary()).toContainText("1 billing statement");
  await expect(summary()).toContainText("Nothing paid yet");
  const statement = statements().getByRole("link", { name: /INV-000001/ });
  await expect(statement).toBeVisible();
  await expect(statement).toContainText("Due");
  expect((await axe(page)).violations).toEqual([]);

  await page.goto("/customers");
  const juan = rows().filter({ hasText: "Juan Dela Cruz" });
  await expect(juan).toContainText("₱1,500.00");
  await expect(juan).toContainText("overdue");
  await expect(juan).toContainText("Today");
  await expect(juan).toContainText("Billing statement");
  await expect(rows().filter({ hasText: "Ana Reyes" })).toContainText("Nothing owed");
  expect((await axe(page)).violations).toEqual([]);

  // A statement opens from their page.
  await page.goto(`/customers/${juanId}`);
  await statements().getByRole("link", { name: /INV-000001/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Billing statement INV-000001" })).toBeVisible();
});

test("a payment brings what they owe down, on their page and on the list", async () => {
  await page.getByRole("button", { name: "Record payment" }).click();
  const dialog = page.getByRole("dialog", { name: "Record a payment" });
  await dialog.getByLabel("Amount received (PHP)").fill("500");
  await dialog.getByLabel("Method").selectOption({ label: "GCash or Maya" });
  await dialog.getByLabel(/^Reference/).fill("GC-123");
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(toast("Payment recorded on Billing statement INV-000001.")).toBeVisible();

  await page.goto(`/customers/${juanId}`);
  await expect(summary()).toContainText("₱1,000.00 overdue");
  await expect(summary()).toContainText("33% of billed");
  await expect(statements().getByRole("link", { name: /INV-000001/ })).toContainText("₱500.00 paid");

  await page.goto("/customers");
  await expect(rows().filter({ hasText: "Juan Dela Cruz" })).toContainText("₱1,000.00");
});

test("from a customer's page, a new quotation opens with them chosen, and the draft shows under Quotations", async () => {
  await page.goto(`/customers/${juanId}`);
  await quotations().getByRole("link", { name: "New quotation" }).click();
  await expect(page).toHaveURL(new RegExp(`/quotes/new\\?customer=${juanId}$`));
  await expect(customerBox()).toHaveValue("Juan Dela Cruz");

  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByLabel("Line 1 description").fill("Aircon repair");
  await page.getByLabel("Price (PHP)").first().fill("2,500");
  await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("status").filter({ hasText: /^\s*Saved$/ })).toBeVisible();

  await page.goto(`/customers/${juanId}`);
  const draft = quotations().getByRole("link", { name: /Draft/ });
  await expect(draft).toBeVisible();
  await expect(draft).toContainText("₱2,500.00");
  // A draft was never sent to them, so it is not activity and owes nothing: the money is unchanged.
  await expect(summary()).toContainText("1 billing statement");
});

test("an archived customer can't be quoted or billed from their page, and can again once restored", async () => {
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByText("Archived. Restore to quote or bill them again.")).toBeVisible();
  await expect(page.getByRole("link", { name: "New quotation" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "New billing statement" })).toHaveCount(0);
  // Their history stays.
  await expect(statements().getByRole("link", { name: /INV-000001/ })).toBeVisible();
  await expect(summary()).toContainText("1 billing statement");

  await page.getByRole("button", { name: "Restore" }).click();
  await expect(toast("Juan Dela Cruz restored.")).toBeVisible();
  await expect(page.getByRole("link", { name: "New quotation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "New billing statement" })).toBeVisible();
});

test("a made-up or foreign customer in the address starts a blank document, not someone else's", async () => {
  await page.goto("/invoices/new?customer=01890000-0000-7000-8000-000000000000");
  await expect(customerBox()).toHaveValue("");
  await page.goto("/quotes/new?customer=not-an-id");
  await expect(customerBox()).toHaveValue("");
});

test("on a phone the record and the list fit the screen and stay accessible", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  const sideways = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

  await page.goto(`/customers/${juanId}`);
  await expect(summary()).toContainText("₱1,000.00 overdue");
  // A phone keeps the two figures that matter; the third (what they've paid) is left out.
  await expect(summary().getByText("Owed", { exact: true })).toBeVisible();
  await expect(summary().getByText("Billed", { exact: true })).toBeVisible();
  await expect(summary().getByText("Paid", { exact: true })).toBeHidden();
  expect(await sideways()).toBe(false);
  expect((await axe(page)).violations).toEqual([]);

  await page.goto("/customers");
  await expect(rows().filter({ hasText: "Juan Dela Cruz" })).toContainText("₱1,000.00");
  expect(await sideways()).toBe(false);
  expect((await axe(page)).violations).toEqual([]);
});

test("while the record loads, its skeleton holds the strip where the figures will be", async () => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/customers");
  const link = rows().filter({ hasText: "Juan Dela Cruz" }).getByRole("link", { name: /Juan Dela Cruz/ });
  await expect(link).toBeVisible();
  // Resting on the link lets the router fetch the page's loading screen, as it does for a person about to click.
  await link.hover();
  await page.waitForLoadState("networkidle");
  let slow = true;
  await page.route(`**/customers/${juanId}**`, async (route) => {
    // Hold back the page's own answer, not the router's prefetch of the loading screen that comes first.
    const { rsc, "next-router-prefetch": prefetch } = route.request().headers();
    if (slow && rsc === "1" && !prefetch) await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });

  await link.click();
  const skeleton = page.getByRole("status").filter({ hasText: "Loading customer" });
  await expect(skeleton).toBeVisible();
  const waiting = await skeleton.locator("ul").first().boundingBox();
  await expect(skeleton).toBeHidden();
  slow = false;
  await expect(summary()).toBeVisible();
  const arrived = await summary().locator("ul").first().boundingBox();
  if (!waiting || !arrived) throw new Error("not on screen");
  expect(Math.abs(waiting.y - arrived.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(waiting.height - arrived.height)).toBeLessThanOrEqual(2);
  expect(Math.abs(waiting.x - arrived.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(waiting.width - arrived.width)).toBeLessThanOrEqual(1);
});
