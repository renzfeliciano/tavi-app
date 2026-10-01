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
  // First run: the checklist ticks off what's done from the business's own data.
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: "Welcome to Tavi" })).toBeVisible();
  await expect(page.getByText("Step 1 (done):")).toBeAttached();
  await expect(page.getByRole("link", { name: "New quote" })).toBeVisible();

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

test("a sent statement can be edited before payment; the customer's link shows the update", async ({ browser }) => {
  await page.goto(invoiceUrl);
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Edit Billing statement INV-000001" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Customer", exact: true })).toBeDisabled();
  await page.getByLabel("Price (PHP)").first().fill("1,800");
  await page.getByRole("button", { name: "Save changes" }).click();
  const confirm = page.getByRole("dialog", { name: "Update Billing statement INV-000001?" });
  await confirm.getByRole("button", { name: "Save changes" }).click();
  await expect(toast("Billing statement INV-000001 updated.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Billing statement INV-000001 · Rev 2" })).toBeVisible();

  const customer = await (await browser.newContext()).newPage();
  await customer.goto(customerLink);
  await expect(customer.getByRole("region", { name: "Balance due" })).toContainText("₱1,800.00");
  await expect(customer.getByText(/^Updated .*This is the latest version\.$/)).toBeVisible();
  await customer.context().close();
});

test("void and duplicate asks for a reason, voids it, and opens a corrected draft", async () => {
  await page.goto(invoiceUrl);
  await page.getByRole("button", { name: "Void and duplicate" }).click();
  const dialog = page.getByRole("dialog", { name: /^Void and duplicate Billing statement INV-000001\?/ });
  await dialog.getByRole("button", { name: "Void and duplicate" }).click();
  await expect(dialog.getByText("Give a reason. It's kept with the record.")).toBeVisible();
  await dialog.getByLabel("Reason").fill("Wrong unit price");
  await dialog.getByRole("button", { name: "Void and duplicate" }).click();
  await expect(toast("Billing statement INV-000001 voided. A corrected copy is ready to edit.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Draft billing statement" })).toBeVisible();
  await expect(page.getByLabel("Line 1 description")).toHaveValue("Aircon cleaning");

  await page.goto(invoiceUrl);
  await expect(page.getByText("Void", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/^Voided .*: Wrong unit price$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Void and duplicate" })).toHaveCount(0);
});

test("recording payments part-pays, then pays in full with tax withheld, and the customer sees them", async ({ browser }) => {
  await page.goto("/invoices");
  await page.getByRole("link", { name: /INV-000002/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Billing statement INV-000002" })).toBeVisible();

  await page.getByRole("button", { name: "Record payment" }).click();
  let dialog = page.getByRole("dialog", { name: "Record a payment" });
  await expect(dialog.getByLabel("Amount received (PHP)")).toHaveValue("2,000.00");
  await dialog.getByLabel("Amount received (PHP)").fill("500");
  await dialog.getByLabel("Method").selectOption({ label: "GCash or Maya" });
  await dialog.getByLabel(/^Reference/).fill("GC-123");
  await expect(dialog.getByRole("checkbox", { name: /Email a payment acknowledgement to juan@example.com/ })).toBeChecked();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(toast("Payment recorded on Billing statement INV-000002.")).toBeVisible();
  await expect(page.getByText("Partially paid", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);

  // Overpaying is refused next to the field.
  await page.getByRole("button", { name: "Record payment" }).click();
  dialog = page.getByRole("dialog", { name: "Record a payment" });
  await dialog.getByLabel("Amount received (PHP)").fill("1,600");
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(dialog.getByText("That's more than the balance due. Record at most the balance.")).toBeVisible();
  await dialog.getByLabel("Amount received (PHP)").fill("1,470");
  await dialog.getByLabel("Tax withheld (BIR Form 2307)").fill("30");
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(toast("Payment recorded on Billing statement INV-000002.")).toBeVisible();
  await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Payments" }).or(page.getByText("Paid in full.")).first()).toBeVisible();

  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(toast("Link copied.")).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const customer = await (await browser.newContext()).newPage();
  await customer.goto(link);
  await expect(customer.getByText("Paid in full. Thank you!")).toBeVisible();
  const history = customer.getByRole("region", { name: "Payments received" });
  await expect(history).toContainText("REC-000001");
  await expect(history).toContainText("Tax withheld (BIR Form 2307)");
  await customer.context().close();
});

test("a payment acknowledgement carries the notice, and voiding a payment reopens the balance", async () => {
  await page.goto("/invoices");
  await page.getByRole("link", { name: /INV-000002/ }).click();
  await page.getByRole("link", { name: "Payment acknowledgement REC-000001" }).click();
  const paper = page.getByRole("article", { name: "Payment acknowledgement REC-000001" });
  await expect(paper).toContainText("₱500.00");
  await expect(paper).toContainText("THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.");
  await expect(paper).toContainText("Not a BIR official receipt.");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.goBack();
  await page.getByRole("button", { name: "Void" }).last().click();
  const dialog = page.getByRole("dialog", { name: "Void payment REC-000002?" });
  await dialog.getByLabel("Reason").fill("Transfer bounced");
  await dialog.getByRole("button", { name: "Void payment" }).click();
  await expect(toast("Payment REC-000002 voided.")).toBeVisible();
  await expect(page.getByText("Partially paid", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Voided: Transfer bounced")).toBeVisible();

  await page.goto("/payments");
  await expect(page.getByRole("region", { name: "Payment list" }).getByRole("listitem")).toHaveCount(2);
});

test("PDFs download for the business and, through the link, for the customer", async ({ browser }) => {
  const readPdf = async (download: import("@playwright/test").Download) => {
    const path = await download.path();
    const { readFile } = await import("node:fs/promises");
    return readFile(path);
  };

  await page.goto("/invoices");
  await page.getByRole("link", { name: /INV-000002/ }).click();
  const [statement] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download PDF" }).click()]);
  expect(statement.suggestedFilename()).toBe("Billing-statement-INV-000002.pdf");
  expect((await readPdf(statement)).subarray(0, 5).toString()).toBe("%PDF-");

  await page.getByRole("link", { name: "Payment acknowledgement REC-000001" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Payment acknowledgement REC-000001" })).toBeVisible();
  const [receipt] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download PDF" }).click()]);
  expect(receipt.suggestedFilename()).toBe("Payment-acknowledgement-REC-000001.pdf");

  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Billing statement INV-000002" })).toBeVisible();
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(toast("Link copied.")).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const customer = await browser.newContext();
  const response = await customer.request.get(`${link}/pdf`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
  expect((await customer.request.get(`${link.replace(/.{4}$/, "xxxx")}/pdf`)).status()).toBe(404);
  await customer.close();
});

test("the dashboard shows money, what needs attention, and recent activity", async () => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  const money = page.getByRole("region", { name: "Money" });
  await expect(money.getByText("Outstanding")).toBeVisible();
  await expect(money).toContainText("₱1,500.00");
  await expect(money.getByText("Paid in the last 30 days")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Needs your attention" })).toBeVisible();
  const activity = page.getByRole("heading", { name: "Recent activity" }).locator("..");
  await expect(activity.getByRole("link", { name: "Payment REC-000002 voided on Billing statement INV-000002" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
