import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { asVisitor, createBusiness, markEmailVerified, signUp, strongPassword, uniqueEmail } from "./helpers";

// The owner deletes a quotation that was sent: it goes to the recycle bin, the customer's link closes, and
// restoring brings it back as it was. Made-up names only. Desktop only (see ACCOUNT_CREATING_SPECS).
test.use({ storageState: { cookies: [], origins: [] }, ...asVisitor("owner-delete") });
test.describe.configure({ mode: "serial" });

let context: BrowserContext;
let page: Page;
let quoteUrl: string;
let customerLink: string;

const toast = (text: string | RegExp) => page.locator("[data-sonner-toast]").filter({ hasText: text });
const axe = (p: Page) =>
  new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("[data-sonner-toaster]").analyze();

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  page = await context.newPage();
  const email = uniqueEmail("owner-delete");
  await signUp(page, { name: "Maria Santos", email, password: strongPassword() });
  await createBusiness(page, "Santos Aircon");
  await markEmailVerified(email);
  await page.goto("/customers/new");
  await page.getByLabel("Name", { exact: true }).fill("Juan Dela Cruz");
  await page.getByRole("textbox", { name: /^Email/ }).fill("juan@example.com");
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(toast("Juan Dela Cruz added.")).toBeVisible();

  await page.goto("/quotes/new");
  await page.getByRole("combobox", { name: "Customer", exact: true }).fill("Juan");
  await page.getByRole("option", { name: /Juan Dela Cruz/ }).click();
  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByLabel("Line 1 description").fill("Aircon cleaning");
  await page.getByLabel("Price (PHP)").first().fill("1,500");
  await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}$/);
  quoteUrl = page.url();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const send = page.getByRole("dialog", { name: "Send quotation" });
  await send.getByLabel("Copy link").check();
  await send.getByRole("button", { name: "Mark as sent and copy link" }).click();
  await expect(toast("Quotation QUO-000001 is ready. Link copied.")).toBeVisible();
  customerLink = await page.evaluate(() => navigator.clipboard.readText());
});

test.afterAll(async () => {
  await context.close();
});

test("the owner deletes a sent quotation: it asks first, then lands in the recycle bin", async () => {
  await page.goto(quoteUrl);
  const trigger = page.locator("#main").getByRole("button", { name: "Delete", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Delete Quotation QUO-000001?" });
  await expect(dialog).toContainText("customer's link stops working");
  expect((await axe(page)).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Keep it" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { level: 1, name: "Quotation QUO-000001" })).toBeVisible();

  await trigger.click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  // The toast is short-lived and the next page may compile slowly in dev, so use its View link as soon as it shows.
  await toast("Quotation QUO-000001 moved to the recycle bin.").getByRole("button", { name: "View" }).click();
  await expect(page).toHaveURL(/\/recycle-bin$/);
  const row = page.locator("#main").getByRole("listitem").filter({ hasText: "Quotation QUO-000001" });
  await expect(row).toContainText("Juan Dela Cruz");
  await expect(row).toContainText("30 days left");
  expect((await axe(page)).violations).toEqual([]);
});

test("the customer's link no longer opens it", async ({ browser }) => {
  const customer = await (await browser.newContext()).newPage();
  await customer.goto(customerLink);
  await expect(customer.getByRole("heading", { name: "This link isn't available" })).toBeVisible();
  await customer.context().close();
});

test("restoring brings it back as it was, with its number", async () => {
  await page.goto("/recycle-bin");
  await page.locator("#main").getByRole("listitem").filter({ hasText: "Quotation QUO-000001" }).getByRole("button", { name: "Restore" }).click();
  await expect(toast("Quotation QUO-000001 for Juan Dela Cruz restored.")).toBeVisible();
  await expect(toast("restored")).toContainText("old link to the customer stays closed");
  await page.goto(quoteUrl);
  await expect(page.getByRole("heading", { level: 1, name: "Quotation QUO-000001" })).toBeVisible();
  await expect(page.getByText("Sent", { exact: true }).first()).toBeVisible();
});
