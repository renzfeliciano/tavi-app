import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { asVisitor, createBusiness, markEmailVerified, signUp, strongPassword, uniqueEmail } from "./helpers";

// One fresh business billing its work: an approved quote becomes a billing
// statement, which is sent as a link and opened by the customer; and a
// statement written from scratch. Desktop only (see ACCOUNT_CREATING_SPECS).
test.use({ storageState: { cookies: [], origins: [] }, ...asVisitor("invoices") });
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
  // The closing dialog keeps its own "Record payment" button until its exit
  // animation ends (production build), so wait before opening it again.
  await expect(dialog).toBeHidden();

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

test("reports total the period's sales and payments, age what's unpaid, and download as CSV", async () => {
  await page.getByRole("link", { name: "Reports" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
  await expect(page.getByRole("link", { name: "This month" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("region", { name: "Sales" })).toContainText("Before tax");
  await expect(page.getByRole("region", { name: "Payments received" })).toContainText("GCash or Maya");
  const unpaid = page.getByRole("region", { name: "Unpaid bills" });
  await expect(unpaid).toContainText("₱1,500.00");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    unpaid.getByRole("link", { name: "Download CSV of unpaid bills" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^unpaid-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await (await download.createReadStream()).toArray();
  expect(Buffer.concat(csv).toString("utf8")).toContain("INV-000002,Billing statement,Juan Dela Cruz");

  await page.getByLabel("From").fill("2026-09-30");
  await page.getByLabel("To", { exact: true }).fill("2026-09-01");
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page.getByText("Choose an end date on or after the start date.")).toBeVisible();
});

// Invoice mode (D13, D14, 1.12), last because it changes this business for
// good: it enters its BIR registration; the next bill is a registered invoice
// with a serial inside the approved series, the registration at the foot, no
// supplementary-document notice, and no way to edit it once sent.
const NOTICE = "THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.";
const FOOTER = "Acknowledgement Certificate / PTU No. 0412-123-00045 · Date issued Sep 15, 2026 · Approved series 001 to 500";
const registeredAxe = (p: Page) =>
  new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("[data-sonner-toaster]").analyze();
let registeredUrl: string;
let registeredLink: string;

test("entering the BIR registration turns invoice mode on, with each problem explained", async () => {
  await page.goto("/settings");
  await page.getByRole("link", { name: /Invoice registration/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Off: new bills are billing statements" })).toBeVisible();
  expect((await registeredAxe(page)).violations).toEqual([]);

  // Registered invoices print the seller's tax status, so it comes first.
  await page.getByRole("button", { name: "Save and turn on invoice mode" }).click();
  await expect(page.getByText("First set how you're registered for tax in Business profile.", { exact: false })).toBeVisible();
  await page.goto("/settings/business");
  await page.getByLabel("Tax registration").selectOption({ label: "VAT-registered" });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(toast("Business profile saved.")).toBeVisible();

  await page.goto("/settings/invoicing");
  await page.getByRole("button", { name: "Save and turn on invoice mode" }).click();
  await expect(page.getByText("Enter the Acknowledgement Certificate or PTU number.")).toBeVisible();
  await page.getByLabel("Acknowledgement Certificate or PTU number").fill("0412-123-00045");
  await page.getByLabel("Date issued").fill("2026-09-15");
  await page.getByLabel("Title on your bills").selectOption("Service Invoice");
  await page.getByLabel("First serial number").fill("1");
  await page.getByLabel("Last serial number").fill("500");
  await page.getByRole("button", { name: "Save and turn on invoice mode" }).click();
  await expect(toast("Invoice registration saved. New bills are issued as “Service Invoice”.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "On: new bills are issued as “Service Invoice”" })).toBeVisible();
  await expect(page.getByText(/next serial 001/)).toBeVisible();
});

test("the next bill is a Service Invoice numbered inside the series, with the registration at its foot", async () => {
  await page.goto("/invoices/new");
  await expect(page.getByRole("heading", { level: 1, name: "New service invoice" })).toBeVisible();
  await page.getByRole("combobox", { name: "Customer", exact: true }).fill("Juan");
  await page.getByRole("option", { name: /Juan Dela Cruz/ }).click();
  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByLabel("Line 1 description").fill("Aircon cleaning");
  await page.getByLabel("Price (PHP)").first().fill("1,500");
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}$/);
  // The editor swaps the URL in place after the first save; the draft's own page names it too.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Draft service invoice" })).toBeVisible();
  registeredUrl = page.url();

  await page.getByRole("button", { name: "Send", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /^Send / });
  await dialog.getByLabel("Copy link").check();
  await dialog.getByRole("button", { name: "Mark as sent and copy link" }).click();
  await expect(toast("Service Invoice 001 is ready. Link copied.")).toBeVisible();
  registeredLink = await page.evaluate(() => navigator.clipboard.readText());

  await expect(page.getByRole("heading", { level: 1, name: "Service Invoice 001" })).toBeVisible();
  const paper = page.getByRole("article", { name: "Service Invoice 001" });
  await expect(paper).toContainText(FOOTER);
  await expect(paper).not.toContainText(NOTICE);
  // A line with no tax is a VAT-exempt sale (RR 7-2024 Sec. 6 B.13–B.14).
  await expect(paper.getByRole("region", { name: "Sales breakdown" })).toContainText("VAT-Exempt Sales₱1,500.00");
  await expect(paper).toContainText("VAT-exempt sale");
  // Registered invoices are locked once issued (RMC 98-2026 Sec. IV.8, D14).
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Void and duplicate" })).toBeVisible();
  expect((await registeredAxe(page)).violations).toEqual([]);

  await page.goto(`${registeredUrl}/edit`);
  await expect(page).toHaveURL(registeredUrl);
});

test("the customer sees the registered invoice and can download it", async ({ browser }) => {
  const customer = await (await browser.newContext()).newPage();
  await customer.goto(registeredLink);
  const paper = customer.getByRole("article", { name: "Service Invoice 001" });
  await expect(paper).toContainText(FOOTER);
  await expect(paper).not.toContainText(NOTICE);
  expect((await registeredAxe(customer)).violations).toEqual([]);
  const pdf = await customer.context().request.get(`${registeredLink}/pdf`);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect(pdf.headers()["content-disposition"]).toContain('filename="Service-Invoice-001.pdf"');
  await customer.context().close();
});

test("after its first PDF, a registered invoice's copies are reprints; it also downloads as an e-invoice (D19)", async () => {
  // The customer's download in the previous test was the original.
  await page.goto(registeredUrl);
  const reprint = page.getByRole("link", { name: "Download reprint" });
  await expect(reprint).toBeVisible();
  const [pdf] = await Promise.all([page.waitForEvent("download"), reprint.click()]);
  expect(pdf.suggestedFilename()).toBe("Service-Invoice-001.pdf");

  const [json] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download e-invoice" }).click()]);
  expect(json.suggestedFilename()).toBe("e-invoice-001.json");
  const { readFile } = await import("node:fs/promises");
  const file = JSON.parse(await readFile(await json.path(), "utf8"));
  expect(file.format.birCertified).toBe(false);
  expect(file.invoices[0]).toMatchObject({ invoiceType: "Service Invoice", serialNo: "001", totals: { totalAmountDue: "1500.00" } });
});

test("a senior citizen's discount shows its breakdown, the ID and a signature line (B.18, D19)", async () => {
  await page.goto("/invoices/new");
  await page.getByRole("combobox", { name: "Customer", exact: true }).fill("Juan");
  await page.getByRole("option", { name: /Juan Dela Cruz/ }).click();
  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByLabel("Line 1 description").fill("Aircon cleaning");
  await page.getByLabel("Price (PHP)").first().fill("1,500");
  await page.getByLabel("Buyer qualifies as").selectOption({ label: "Senior citizen (20%, VAT-exempt)" });
  await page.getByLabel("OSCA / SC ID No.").fill("OSCA-0042");
  await page.getByLabel("Name on the ID").fill("Juan Dela Cruz");

  const preview = page.getByRole("complementary", { name: "Preview" });
  await expect(preview).toContainText("Less: Senior citizen discount (20%)−₱300.00");
  await expect(preview).toContainText("Total Amount Due₱1,200.00");
  await expect(preview).toContainText("OSCA / SC ID No. OSCA-0042");
  await expect(preview).toContainText("Signature over printed name");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Send", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /^Send / });
  await dialog.getByLabel("Copy link").check();
  await dialog.getByRole("button", { name: "Mark as sent and copy link" }).click();
  await expect(toast("Service Invoice 002 is ready. Link copied.")).toBeVisible();
  const paper = page.getByRole("article", { name: "Service Invoice 002" });
  await expect(paper.getByRole("region", { name: "Qualified discount" })).toContainText("Senior citizen: Juan Dela Cruz");
  expect((await registeredAxe(page)).violations).toEqual([]);
});

test("turning invoice mode off asks first, and the next bill is a billing statement again", async () => {
  await page.goto("/settings/invoicing");
  await page.getByRole("button", { name: "Turn off invoice mode" }).click();
  const dialog = page.getByRole("dialog", { name: "Turn off invoice mode?" });
  await dialog.getByRole("button", { name: "Turn off", exact: true }).click();
  await expect(toast("Invoice mode is off. New bills are billing statements again.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Off: new bills are billing statements" })).toBeVisible();

  await page.goto("/invoices/new");
  await expect(page.getByRole("heading", { level: 1, name: "New billing statement" })).toBeVisible();
});
