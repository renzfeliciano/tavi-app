import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { createBusiness, markEmailVerified, signUp, strongPassword, uniqueEmail } from "./helpers";

// One fresh business billing its work: an approved quote becomes a billing
// statement, which is sent as a link and opened by the customer; and a
// statement written from scratch. Desktop only (see ACCOUNT_CREATING_SPECS).
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });
// Each test walks a whole flow across two browsers (and the dev server compiles
// each page on first visit), so give them the slow budget.
test.slow();

let context: BrowserContext;
let page: Page;
let invoiceUrl: string;
let customerLink: string;

const toast = (text: string | RegExp) => page.locator("[data-sonner-toast]").filter({ hasText: text });

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  page = await context.newPage();
  const email = uniqueEmail("invoices");
  await signUp(page, { name: "Maria Santos", email, password: strongPassword() });
  await createBusiness(page, "Santos Aircon");
  await markEmailVerified(email);
  await page.goto("/settings/business");
  await page.getByLabel("How to pay you").fill("GCash 0917 123 4567 (Maria Santos)");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(toast("Business profile saved.")).toBeVisible();
  await page.goto("/customers/new");
  await page.getByLabel("Name", { exact: true }).fill("Juan Dela Cruz");
  await page.getByRole("textbox", { name: /^Email/ }).fill("juan@example.com");
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(toast("Juan Dela Cruz added.")).toBeVisible();
});

test.afterAll(async () => {
  await context.close();
});

async function fillDraft(price: string) {
  await page.getByRole("combobox", { name: "Customer", exact: true }).fill("Juan");
  await page.getByRole("option", { name: /Juan Dela Cruz/ }).click();
  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByLabel("Line 1 description").fill("Aircon cleaning");
  await page.getByLabel("Price (PHP)").first().fill(price);
}

async function sendByLink(): Promise<string> {
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /^Send / });
  await dialog.getByLabel("Copy link").check();
  await dialog.getByRole("button", { name: "Mark as sent and copy link" }).click();
  await expect(toast(/is ready\. Link copied\./)).toBeVisible();
  return page.evaluate(() => navigator.clipboard.readText());
}

test("an approved quote becomes a draft billing statement with the same items", async ({ browser }) => {
  await page.goto("/quotes/new");
  await fillDraft("1,500");
  await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}$/);
  const quoteUrl = page.url();
  const quoteLink = await sendByLink();

  const customer = await (await browser.newContext()).newPage();
  await customer.goto(quoteLink);
  await customer.getByRole("button", { name: "Approve quote" }).click();
  const approve = customer.getByRole("dialog", { name: /^Approve / });
  await approve.getByLabel("Your name").fill("Juan Dela Cruz");
  await approve.getByRole("checkbox").click();
  await approve.getByRole("button", { name: "Approve quote" }).click();
  await expect(customer.getByText(/^Approved by Juan Dela Cruz/)).toBeVisible();
  await customer.context().close();

  await page.goto(quoteUrl);
  await page.getByRole("button", { name: "Create billing statement" }).click();
  await expect(toast(/^Draft billing statement created from Quotation QUO-/)).toBeVisible();
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}$/);
  invoiceUrl = page.url();
  await expect(page.getByRole("heading", { level: 1, name: "Draft billing statement" })).toBeVisible();
  await expect(page.getByLabel("Line 1 description")).toHaveValue("Aircon cleaning");
  await expect(page.getByLabel("Due date")).not.toHaveValue("");

  // The quote now points at its statement instead of offering another.
  await page.goto(quoteUrl);
  await expect(page.getByRole("link", { name: "View billing statement" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel quote" })).toHaveCount(0);
});

test("sending numbers the statement and the customer sees what to pay and how", async ({ browser }) => {
  await page.goto(invoiceUrl);
  customerLink = await sendByLink();
  expect(customerLink).toMatch(/\/i\/[\w-]{43}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Billing statement INV-000001" })).toBeVisible();
  await expect(page.getByText("Unpaid", { exact: true }).first()).toBeVisible();

  const customer = await (await browser.newContext()).newPage();
  const response = await customer.goto(customerLink);
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  const balance = customer.getByRole("region", { name: "Balance due" });
  await expect(balance).toContainText("₱1,500.00");
  await expect(balance).toContainText("GCash 0917 123 4567 (Maria Santos)");
  const paper = customer.getByRole("article", { name: "Billing statement INV-000001" });
  await expect(paper).toContainText("Juan Dela Cruz");
  await expect(paper).toContainText("THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.");
  expect((await new AxeBuilder({ page: customer }).analyze()).violations).toEqual([]);
  await customer.context().close();

  await page.reload();
  await expect(page.getByText(/Opened by the customer/)).toBeVisible();
});

test("a billing statement written from scratch can be emailed, and a draft deleted", async () => {
  await page.goto("/invoices/new");
  await fillDraft("2,000");
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /^Send / });
  await expect(dialog.getByLabel("To", { exact: true })).toHaveValue("juan@example.com");
  await dialog.getByRole("button", { name: "Send email" }).click();
  await expect(toast("Billing statement INV-000002 sent to juan@example.com.")).toBeVisible();

  await page.goto("/invoices/new");
  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByLabel("Line 1 description").fill("Site visit");
  await page.getByLabel("Price (PHP)").first().fill("500");
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Delete draft" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete draft" }).click();
  await expect(toast("Draft deleted.")).toBeVisible();
  await expect(page).toHaveURL(/\/invoices$/);
  await expect(page.getByRole("region", { name: "Billing statement list" }).getByRole("listitem")).toHaveCount(2);
});
