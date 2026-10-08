import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { asVisitor, createBusiness, signUp, strongPassword, uniqueEmail } from "./helpers";

// One fresh business writing its first quote. Desktop only (see
// ACCOUNT_CREATING_SPECS in playwright.config.ts): sign-up is rate limited per IP.
test.use({ storageState: { cookies: [], origins: [] }, ...asVisitor("quotes") });
test.describe.configure({ mode: "serial" });

let page: Page;
let quoteUrl: string;

const axe = (p: Page) =>
  new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
const toast = (text: string) => page.locator("[data-sonner-toast]").filter({ hasText: text });
const preview = () => page.getByRole("complementary", { name: "Preview" });

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await signUp(page, { name: "Maria Santos", email: uniqueEmail("quotes"), password: strongPassword() });
  await createBusiness(page, "Santos Aircon");
  // A default tax and one service to pick.
  await page.goto("/settings/tax-rates");
  await page.getByRole("button", { name: /^Add VAT/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Add tax" }).click();
  await expect(toast("VAT added.")).toBeVisible();
  await page.goto("/catalog/services/new");
  await page.getByLabel("Name", { exact: true }).fill("Aircon cleaning");
  await page.getByLabel("Price per unit").fill("1,500");
  await page.getByLabel("Unit", { exact: true }).selectOption("unit");
  await page.getByRole("button", { name: "Add service" }).click();
  await expect(toast("Aircon cleaning added.")).toBeVisible();
});

test.afterAll(async () => {
  await page.context().close();
});

test("opening a new quote saves nothing until something changes", async () => {
  await page.goto("/quotes");
  await page.getByRole("link", { name: "New quote" }).first().click();
  await expect(page).toHaveURL(/\/quotes\/new$/);
  await expect(preview()).toContainText("Quotation");
  await expect(preview()).toContainText("No items yet");
  // A quotation is a supplementary document under RR 7-2024 (D13).
  await expect(preview()).toContainText("THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.");
  expect((await axe(page)).violations).toEqual([]);

  await page.goto("/quotes");
  await expect(page.getByRole("heading", { name: "No quotes yet" })).toBeVisible();
});

test("building a quote: new customer inline, a catalog item, a free-text line, live totals, autosave", async () => {
  await page.goto("/quotes/new");

  // Customer created without leaving the quote.
  await page.getByRole("combobox", { name: "Customer", exact: true }).click();
  await page.getByRole("button", { name: "Add a new customer" }).click();
  const sheet = page.getByRole("dialog", { name: "Add a new customer" });
  await sheet.getByLabel("Name", { exact: true }).fill("Juan Dela Cruz");
  await sheet.getByRole("button", { name: "Add customer" }).click();
  await expect(toast("Juan Dela Cruz added.")).toBeVisible();
  await expect(preview()).toContainText("Juan Dela Cruz");

  // A catalog item, priced and taxed from the catalog.
  const picker = page.getByRole("combobox", { name: "Add from Products & Services", exact: true });
  await picker.fill("aircon");
  await page.getByRole("option", { name: /Aircon cleaning/ }).click();
  await expect(page.getByLabel("Line 1 description")).toHaveValue("Aircon cleaning");
  await page.getByLabel("Qty").first().fill("2");

  // A free-text line with a discount.
  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByLabel("Line 2 description").fill("Filter replacement");
  await page.getByLabel("Price (PHP)").nth(1).fill("500");
  await page.getByLabel("Discount").nth(1).selectOption("percent");
  await page.getByLabel("Line 2 discount percent").fill("10");

  // Prices include tax (the market default): 3,000 + 450 = 3,450.
  await expect(preview()).toContainText("₱3,450.00");
  await expect(preview()).toContainText("Includes VAT 12%");

  // Autosave creates the draft and moves the address to it.
  await expect(page.getByRole("status").filter({ hasText: /^\s*Saved$/ })).toBeVisible();
  await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}$/);
  quoteUrl = page.url();
  expect((await axe(page)).violations).toEqual([]);

  // The address stays on the draft: reloading reopens it, not a blank quote.
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page).toHaveURL(quoteUrl);
  await expect(page.getByLabel("Line 1 description")).toHaveValue("Aircon cleaning");
});

test("the draft comes back exactly as left, and shows in the list", async () => {
  await page.goto(quoteUrl);
  await expect(page.getByLabel("Line 1 description")).toHaveValue("Aircon cleaning");
  await expect(page.getByLabel("Line 2 discount percent")).toHaveValue("10");
  await expect(preview()).toContainText("₱3,450.00");

  await page.goto("/quotes");
  const row = page.getByRole("region", { name: "Quote list" }).getByRole("link", { name: /Juan Dela Cruz/ });
  await expect(row).toContainText("₱3,450.00");
  await expect(row).toContainText("Draft");
});

test("a problem is explained on its field and nothing broken is saved", async () => {
  await page.goto(quoteUrl);
  const qty = page.getByLabel("Qty").first();
  await qty.fill("two");
  await qty.blur();
  await expect(page.getByText("Enter a quantity like 1.5.")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Not saved yet" })).toBeVisible();
  await qty.fill("3");
  await expect(page.getByRole("status").filter({ hasText: /^\s*Saved$/ })).toBeVisible();
  await expect(preview()).toContainText("₱4,950.00");
});

test("deleting the draft asks first, then confirms", async () => {
  await page.goto(quoteUrl);
  await page.getByRole("button", { name: "Delete draft" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this draft?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete draft" }).click();
  await expect(toast("Draft deleted.")).toBeVisible();
  await expect(page).toHaveURL(/\/quotes$/);
  await expect(page.getByRole("heading", { name: "No quotes yet" })).toBeVisible();
});
