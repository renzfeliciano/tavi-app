import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { asVisitor, createBusiness, markEmailVerified, signUp, strongPassword, tableRows, uniqueEmail } from "./helpers";

// A business receives money that is not an invoice payment: it makes a receipt for a typed payer, one for a customer
// with an emailed copy, voids one with a reason, and sees that the invoice and the payments list are untouched.
// Made-up names and numbers only. Desktop only (see ACCOUNT_CREATING_SPECS).
test.use({ storageState: { cookies: [], origins: [] }, ...asVisitor("receipts") });
test.describe.configure({ mode: "serial" });
test.slow();

let context: BrowserContext;
let page: Page;
let invoiceUrl: string;
let firstReceiptUrl: string;

const toast = (text: string | RegExp) => page.locator("[data-sonner-toast]").filter({ hasText: text });
const axe = (p: Page) =>
  new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("[data-sonner-toaster]").analyze();
const scrollsSideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  const email = uniqueEmail("receipts");
  await signUp(page, { name: "Maria Santos", email, password: strongPassword() });
  await createBusiness(page, "Santos Aircon");
  await markEmailVerified(email);
  await page.goto("/customers/new");
  await page.getByLabel("Name", { exact: true }).fill("Juan Dela Cruz");
  await page.getByRole("textbox", { name: /^Email/ }).fill("juan@example.com");
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(toast("Juan Dela Cruz added.")).toBeVisible();

  // One invoice with one payment of ₱500, so receipts can be compared against real invoice figures.
  await page.goto("/invoices/new");
  await page.getByRole("combobox", { name: "Customer", exact: true }).fill("Juan");
  await page.getByRole("option", { name: /Juan Dela Cruz/ }).click();
  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByLabel("Line 1 description").fill("Aircon cleaning");
  await page.getByLabel("Price (PHP)").first().fill("2,000");
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}$/);
  invoiceUrl = page.url();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const send = page.getByRole("dialog", { name: /^Send / });
  await send.getByLabel("Copy link").check();
  await send.getByRole("button", { name: "Mark as sent and copy link" }).click();
  await expect(toast(/is ready\. Link copied\./)).toBeVisible();
  await page.getByRole("button", { name: "Record payment" }).click();
  const dialog = page.getByRole("dialog", { name: "Record a payment" });
  await dialog.getByLabel("Amount received (PHP)").fill("500");
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(toast(/Payment recorded on/)).toBeVisible();
  await expect(page.getByText(/^Balance due/)).toContainText("₱1,500.00");
});

test.afterAll(async () => {
  await context.close();
});

test("Payments leads to an empty Receipts page, and its button opens the form", async () => {
  await page.goto("/payments");
  await page.getByRole("link", { name: "Receipts", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Receipts" })).toBeVisible();
  await expect(page.getByText("No receipts yet")).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);
  await page.locator("#main").getByRole("link", { name: "New receipt" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "New receipt" })).toBeVisible();
});

test("a receipt for someone who isn't a customer takes the next number in the same series, and downloads as a PDF", async () => {
  await page.goto("/receipts/new");
  // Problems show beside their fields.
  await page.getByRole("button", { name: "Make receipt" }).click();
  await expect(page.getByText("Enter who paid.")).toBeVisible();
  await expect(page.getByText("Enter the amount received.")).toBeVisible();
  await expect(page.getByText("Say what the money is for.")).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);

  await page.getByRole("radio", { name: "Someone else" }).check();
  await page.getByLabel("Payer's name").fill("Pedro Reyes");
  await page.getByLabel("Amount received (PHP)").fill("1,500");
  await page.getByLabel("Received for").fill("Reimbursement of fuel");
  await page.getByRole("button", { name: "Make receipt" }).click();

  // REC-000001 went to the invoice payment; a receipt continues the same run.
  await expect(toast("Receipt REC-000002 made.")).toBeVisible();
  await expect(page).toHaveURL(/\/receipts\/[0-9a-f-]{36}$/);
  firstReceiptUrl = page.url();
  await expect(page.getByRole("heading", { level: 1, name: "Collection receipt REC-000002" })).toBeVisible();
  const paper = page.getByRole("article", { name: "Collection receipt REC-000002" });
  await expect(paper).toContainText("Pedro Reyes");
  await expect(paper).toContainText("Reimbursement of fuel");
  await expect(paper).toContainText("₱1,500.00");
  await expect(paper).toContainText("Not a BIR official receipt.");
  expect((await axe(page)).violations).toEqual([]);

  const pdf = await page.request.get(`${firstReceiptUrl}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect(pdf.headers()["content-disposition"]).toMatch(/^attachment/);
  expect(pdf.headers()["cache-control"]).toContain("no-store");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("an acknowledgement receipt for a customer offers their email, and a copy can be emailed again", async () => {
  await page.goto("/receipts/new");
  await page.getByLabel("Title").selectOption("acknowledgement");
  await page.getByRole("combobox", { name: "Customer", exact: true }).fill("Juan");
  await page.getByRole("option", { name: /Juan Dela Cruz/ }).click();
  await expect(page.getByLabel("Payer's name")).toHaveValue("Juan Dela Cruz");
  await expect(page.getByRole("checkbox", { name: /Email a copy to juan@example.com/ })).toBeChecked();
  await page.getByLabel("Amount received (PHP)").fill("300");
  await page.getByLabel("Received for").fill("Deposit for event");
  await page.getByRole("button", { name: "Make receipt" }).click();
  await expect(toast("Receipt REC-000003 made.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Acknowledgement receipt REC-000003" })).toBeVisible();

  await page.getByRole("button", { name: "Email a copy" }).click();
  const dialog = page.getByRole("dialog", { name: "Email receipt REC-000003" });
  await expect(dialog.getByRole("checkbox", { name: /Send to juan@example.com/ })).toBeChecked();
  await dialog.getByLabel(/Also send to another email/).fill("ana@example.com");
  await dialog.getByRole("button", { name: "Add" }).click();
  await dialog.getByRole("button", { name: "Send" }).click();
  await expect(toast("Sent to 2 people.")).toBeVisible();
});

test("voiding needs a reason, keeps the receipt on the record, and takes away Void and Email", async () => {
  await page.goto(firstReceiptUrl);
  await page.getByRole("button", { name: "Void", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Void receipt REC-000002?" });
  await dialog.getByRole("button", { name: "Void receipt" }).click();
  await expect(dialog.getByText("Give a reason. It's kept with the record.")).toBeVisible();
  await dialog.getByLabel("Reason").fill("Wrong amount");
  await dialog.getByRole("button", { name: "Void receipt" }).click();
  await expect(toast("Receipt REC-000002 voided.")).toBeVisible();

  await expect(page.getByText("Voided: Wrong amount")).toBeVisible();
  await expect(page.getByRole("button", { name: "Void", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Email a copy" })).toHaveCount(0);
  expect((await axe(page)).violations).toEqual([]);
  const pdf = await page.request.get(`${firstReceiptUrl}/pdf`);
  expect(pdf.status()).toBe(200);

  await page.goto("/receipts");
  await expect(tableRows(page, "Receipt list")).toHaveCount(2);
  await expect(tableRows(page, "Receipt list").filter({ hasText: "REC-000002" })).toContainText("Voided");
  await page.getByRole("link", { name: "Voided", exact: true }).click();
  await expect(page).toHaveURL(/view=voided/);
  await expect(tableRows(page, "Receipt list")).toHaveCount(1);
  await page.getByRole("link", { name: "Acknowledgement receipt", exact: true }).click();
  await expect(tableRows(page, "Receipt list")).toHaveCount(1);
  await expect(tableRows(page, "Receipt list").first()).toContainText("REC-000003");
  expect((await axe(page)).violations).toEqual([]);
});

test("receipts leave the invoice and the payments list alone", async () => {
  await page.goto(invoiceUrl);
  await expect(page.getByText(/^Balance due/)).toContainText("₱1,500.00");
  await page.goto("/payments");
  await expect(tableRows(page, "Payment list")).toHaveCount(1);
  await expect(tableRows(page, "Payment list").first()).toContainText("REC-000001");
});

test("the pages read well in dark mode and on a phone", async () => {
  await page.emulateMedia({ colorScheme: "dark" });
  for (const path of ["/receipts", "/receipts/new", firstReceiptUrl]) {
    await page.goto(path);
    expect((await axe(page)).violations, `${path} in dark mode`).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: "light" });

  await page.setViewportSize({ width: 360, height: 800 });
  for (const path of ["/receipts", "/receipts/new", firstReceiptUrl, "/payments"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await scrollsSideways(page), `${path} scrolls sideways at 360px`).toBe(false);
  }
});
