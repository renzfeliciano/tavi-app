import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { asVisitor, createBusiness, markEmailVerified, signUp, strongPassword, tableRows, uniqueEmail } from "./helpers";

// A business buys from a supplier: it adds one, writes a purchase order, saves it as a draft, issues it (numbered),
// downloads the PDF, emails the supplier, marks it received, and cancels a second order with a reason.
// Made-up names and numbers only. Desktop only (see ACCOUNT_CREATING_SPECS).
test.use({ storageState: { cookies: [], origins: [] }, ...asVisitor("purchase-orders") });
test.describe.configure({ mode: "serial" });
test.slow();

let context: BrowserContext;
let page: Page;
let firstOrderUrl: string;

const toast = (text: string | RegExp) => page.locator("[data-sonner-toast]").filter({ hasText: text });
const axe = (p: Page) =>
  new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("[data-sonner-toaster]").analyze();
const scrollsSideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

/** Fills the new-order form with one line for Santos Hardware. */
async function fillOrder(description: string, price: string) {
  await page.getByRole("combobox", { name: "Supplier", exact: true }).fill("Santos");
  await page.getByRole("option", { name: /Santos Hardware/ }).click();
  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByLabel("Line 1 description").fill(description);
  await page.getByLabel("Qty").fill("2");
  await page.getByLabel("Price (PHP)").first().fill(price);
}

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  const email = uniqueEmail("purchase-orders");
  await signUp(page, { name: "Maria Santos", email, password: strongPassword() });
  await createBusiness(page, "Reyes Aircon");
  await markEmailVerified(email);
});

test.afterAll(async () => {
  await context.close();
});

test("the sidebar leads to an empty page whose button opens the form, and a supplier can be added", async () => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Purchase orders", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Purchase orders" })).toBeVisible();
  await expect(page.getByText("No purchase orders yet")).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);

  await page.getByRole("link", { name: "Suppliers", exact: true }).click();
  await expect(page.getByText("No suppliers yet")).toBeVisible();
  await page.goto("/suppliers/new");
  await page.getByLabel("Name", { exact: true }).fill("Santos Hardware");
  await page.getByRole("textbox", { name: /^Email/ }).fill("orders@santos.example");
  await page.getByRole("button", { name: "Add supplier" }).click();
  await expect(toast("Santos Hardware added.")).toBeVisible();
  await expect(page).toHaveURL(/\/suppliers\/[0-9a-f-]{36}$/);

  await page.goto("/purchase-orders");
  await page.locator("#main").getByRole("link", { name: "New purchase order" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "New purchase order" })).toBeVisible();
});

test("Issue says what is missing, field by field, before anything is saved", async () => {
  await page.goto("/purchase-orders/new");
  await page.getByRole("button", { name: "Issue", exact: true }).click();
  await expect(page.getByText("Choose a supplier before issuing.")).toBeVisible();
  await expect(page.getByText("Add at least one item before issuing.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await axe(page)).violations).toEqual([]);
});

test("a draft is saved as typed, can be edited, and has no PDF until it is issued", async () => {
  await page.goto("/purchase-orders/new");
  await fillOrder("Copper pipe 1/2 in", "145.50");
  await expect(page.getByText("Total", { exact: true }).locator("..")).toContainText("₱291.00");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(toast("Draft saved.")).toBeVisible();
  await expect(page).toHaveURL(/\/purchase-orders\/[0-9a-f-]{36}$/);
  firstOrderUrl = page.url();
  await expect(page.getByRole("heading", { level: 1, name: "Draft purchase order" })).toBeVisible();
  await expect(page.getByRole("article", { name: "Purchase order" })).toContainText("Santos Hardware");
  expect((await page.request.get(`${firstOrderUrl}/pdf`)).status()).toBe(404);

  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByLabel("Line 1 description")).toHaveValue("Copper pipe 1/2 in");
  await page.getByRole("textbox", { name: "Notes", exact: true }).fill("Deliver to the back door.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(toast("Draft saved.")).toBeVisible();
  await expect(page.getByRole("article", { name: "Purchase order" })).toContainText("Deliver to the back door.");
});

test("issuing asks first, numbers the order, locks it, and the PDF downloads", async () => {
  await page.goto(firstOrderUrl);
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Issue", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Issue this purchase order?" });
  await expect(dialog.getByLabel("Send to")).toHaveValue("orders@santos.example");
  await dialog.getByRole("checkbox", { name: /Email it to the supplier now/ }).uncheck();
  await dialog.getByRole("button", { name: "Issue purchase order" }).click();

  await expect(toast("PO-000001 issued.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Purchase order PO-000001" })).toBeVisible();
  const paper = page.getByRole("article", { name: "Purchase order PO-000001" });
  await expect(paper).toContainText("Order to");
  await expect(paper).toContainText("Santos Hardware");
  await expect(paper).toContainText("₱291.00");
  await expect(paper).toContainText("THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.");
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
  expect((await axe(page)).violations).toEqual([]);

  // An issued order can't be opened for editing.
  await page.goto(`${firstOrderUrl}/edit`);
  await expect(page).toHaveURL(firstOrderUrl);

  const pdf = await page.request.get(`${firstOrderUrl}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect(pdf.headers()["content-disposition"]).toMatch(/^attachment/);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("the supplier can be emailed, and the order marked received with a date and note", async () => {
  await page.goto(firstOrderUrl);
  await page.getByRole("button", { name: "Email supplier" }).click();
  const email = page.getByRole("dialog", { name: "Email PO-000001" });
  await expect(email.getByLabel("Send to")).toHaveValue("orders@santos.example");
  await email.getByRole("button", { name: "Send" }).click();
  await expect(toast("Sent to orders@santos.example.")).toBeVisible();

  await page.getByRole("button", { name: "Mark received" }).click();
  const dialog = page.getByRole("dialog", { name: "Mark PO-000001 received?" });
  await expect(dialog.getByLabel("Date received")).not.toHaveValue("");
  await dialog.getByLabel(/Note/).fill("Two boxes short.");
  await dialog.getByRole("button", { name: "Mark as received" }).click();
  await expect(toast("PO-000001 marked received.")).toBeVisible();
  await expect(page.getByText(/Received .*: Two boxes short\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark received" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
  await expect(page.getByRole("article", { name: "Purchase order PO-000001" })).toContainText("Received");
  expect((await axe(page)).violations).toEqual([]);
});

test("cancelling needs a reason, keeps the order on the record, and its number isn't reused", async () => {
  await page.goto("/purchase-orders/new");
  await fillOrder("Valve", "80");
  await page.getByRole("button", { name: "Issue", exact: true }).click();
  await page.getByRole("checkbox", { name: /Email it to the supplier now/ }).uncheck();
  await page.getByRole("button", { name: "Issue purchase order" }).click();
  await expect(toast("PO-000002 issued.")).toBeVisible();

  await page.getByRole("button", { name: "Cancel order" }).click();
  const dialog = page.getByRole("dialog", { name: "Cancel PO-000002?" });
  await dialog.getByRole("button", { name: "Cancel purchase order" }).click();
  await expect(dialog.getByText("Say why you are cancelling it.")).toBeVisible();
  await dialog.getByLabel("Reason").fill("Supplier is out of stock.");
  await dialog.getByRole("button", { name: "Cancel purchase order" }).click();
  await expect(toast("PO-000002 cancelled.")).toBeVisible();
  await expect(page.getByText("Cancelled: Supplier is out of stock.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Email supplier" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Download PDF" })).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);
});

test("the list shows both, filters by status, and finds an order by supplier", async () => {
  await page.goto("/purchase-orders");
  await expect(tableRows(page, "Purchase order list")).toHaveCount(2);
  await expect(tableRows(page, "Purchase order list").filter({ hasText: "PO-000002" })).toContainText("Cancelled");
  await page.getByRole("link", { name: "Received", exact: true }).click();
  await expect(page).toHaveURL(/status=RECEIVED/);
  await expect(tableRows(page, "Purchase order list")).toHaveCount(1);
  await expect(tableRows(page, "Purchase order list").first()).toContainText("PO-000001");
  await page.getByRole("link", { name: "All", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search purchase orders" }).fill("Santos");
  await expect(tableRows(page, "Purchase order list")).toHaveCount(2);
  expect((await axe(page)).violations).toEqual([]);
});

test("the pages read well in dark mode and on a phone", async () => {
  await page.emulateMedia({ colorScheme: "dark" });
  for (const path of ["/purchase-orders", "/purchase-orders/new", firstOrderUrl, "/suppliers"]) {
    await page.goto(path);
    expect((await axe(page)).violations, `${path} in dark mode`).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: "light" });

  await page.setViewportSize({ width: 360, height: 800 });
  for (const path of ["/purchase-orders", "/purchase-orders/new", firstOrderUrl, "/suppliers"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await scrollsSideways(page), `${path} scrolls sideways at 360px`).toBe(false);
  }
});
