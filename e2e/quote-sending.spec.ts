import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { createBusiness, markEmailVerified, signUp, strongPassword, uniqueEmail } from "./helpers";

// One fresh business sending a quote and following it through revise and
// cancel, plus the customer's view. Desktop only (see ACCOUNT_CREATING_SPECS).
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

let context: BrowserContext;
let page: Page;
let email: string;
let quoteUrl: string;
let customerLink: string;

const axe = (p: Page) =>
  new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
const toast = (text: string | RegExp) => page.locator("[data-sonner-toast]").filter({ hasText: text });

async function newQuote(customerName: string) {
  await page.goto("/quotes/new");
  await page.getByRole("combobox", { name: "Customer", exact: true }).fill(customerName.split(" ")[0] ?? "");
  await page.getByRole("option", { name: new RegExp(customerName) }).click();
  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByLabel("Line 1 description").fill("Aircon cleaning");
  await page.getByLabel("Price (PHP)").first().fill("1,500");
  await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}$/);
}

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  page = await context.newPage();
  email = uniqueEmail("sending");
  await signUp(page, { name: "Maria Santos", email, password: strongPassword() });
  await createBusiness(page, "Santos Aircon");
  // Letterhead details for the customer's view (RR 7-2024 Sec. 6 B.1–B.3).
  await page.goto("/settings/business");
  await page.getByLabel("TIN").fill("123-456-789-00000");
  await page.getByLabel("Tax registration").selectOption({ label: "VAT-registered" });
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

test("sending waits until the sender's own email is confirmed", async () => {
  await newQuote("Juan Dela Cruz");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Send quotation" });
  await expect(dialog.getByText("Confirm your email address before sending.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Send email" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Not yet" }).click();
});

test("sending by link numbers the quote and copies a link the customer can open", async () => {
  await markEmailVerified(email);
  await page.reload();
  quoteUrl = page.url();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Send quotation" });
  expect((await axe(page)).violations).toEqual([]);
  await dialog.getByLabel("Copy link").check();
  await dialog.getByRole("button", { name: "Mark as sent and copy link" }).click();

  await expect(toast("Quotation QUO-000001 is ready. Link copied.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Quotation QUO-000001" })).toBeVisible();
  await expect(page.getByText("Sent", { exact: true }).first()).toBeVisible();
  customerLink = await page.evaluate(() => navigator.clipboard.readText());
  expect(customerLink).toMatch(/\/q\/[\w-]{43}$/);
});

test("the customer sees the quotation with the business's letterhead, and no one else's", async ({ browser }) => {
  const customer = await (await browser.newContext()).newPage();
  const response = await customer.goto(customerLink);
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  // Next.js sets Cache-Control on dynamic pages itself: the production build
  // (CI) must send no-store; the dev server sends no-cache.
  expect(response?.headers()["cache-control"]).toMatch(process.env.CI ? /no-store/ : /no-store|no-cache/);

  const paper = customer.getByRole("article", { name: "Quotation QUO-000001" });
  await expect(paper).toContainText("Santos Aircon");
  await expect(paper).toContainText("VAT Reg TIN 123-456-789-00000");
  await expect(paper).toContainText("Juan Dela Cruz");
  await expect(paper).toContainText("THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.");
  expect((await new AxeBuilder({ page: customer }).analyze()).violations).toEqual([]);
  const pdf = await customer.context().request.get(`${customerLink}/pdf`);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect(pdf.headers()["content-disposition"]).toContain('filename="Quotation-QUO-000001.pdf"');

  await customer.goto(customerLink.replace(/.{4}$/, "xxxx"));
  await expect(customer.getByRole("heading", { name: "This link isn't available" })).toBeVisible();
  await customer.context().close();
});

test("revising reopens it as revision 2 and closes the old link", async ({ browser }) => {
  await page.goto(quoteUrl);
  await page.getByRole("button", { name: "Revise" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Revise quote" }).click();
  await expect(toast("Quotation QUO-000001 is open for changes.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Quotation QUO-000001" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeVisible();

  const customer = await (await browser.newContext()).newPage();
  await customer.goto(customerLink);
  await expect(customer.getByRole("heading", { name: "This link isn't available" })).toBeVisible();
  await customer.context().close();
});

test("sending by email goes to the customer's address", async () => {
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Send quotation" });
  await expect(dialog.getByLabel("To", { exact: true })).toHaveValue("juan@example.com");
  await dialog.getByRole("button", { name: "Send email" }).click();
  await expect(toast("Quotation QUO-000001 sent to juan@example.com.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Quotation QUO-000001 · Rev 2" })).toBeVisible();
});

test("cancelling asks for an optional reason and confirms", async () => {
  await page.getByRole("button", { name: "Cancel quote" }).click();
  const dialog = page.getByRole("dialog", { name: /Cancel Quotation QUO-000001/ });
  await dialog.getByLabel("Reason").fill("Customer postponed");
  await dialog.getByRole("button", { name: "Cancel quote" }).click();
  await expect(toast("Quotation QUO-000001 cancelled.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy link" })).toHaveCount(0);
  await expect(page.getByText("Cancelled").first()).toBeVisible();
});

async function sendByLink(): Promise<{ url: string; link: string }> {
  await newQuote("Juan Dela Cruz");
  const url = page.url();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Send quotation" });
  await dialog.getByLabel("Copy link").check();
  await dialog.getByRole("button", { name: "Mark as sent and copy link" }).click();
  await expect(toast(/is ready\. Link copied\./)).toBeVisible();
  return { url, link: await page.evaluate(() => navigator.clipboard.readText()) };
}

test("the customer approves with their name, and the business sees who and when", async ({ browser }) => {
  test.slow(); // two browsers, and a full dev run compiles pages under load
  const { url, link } = await sendByLink();
  const customer = await (await browser.newContext()).newPage();
  await customer.goto(link);

  // Opening the link marks it viewed for the business.
  await page.goto(url);
  await expect(page.getByText("Viewed", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/^Opened by the customer/)).toBeVisible();

  await customer.getByRole("button", { name: "Approve quote" }).click();
  const dialog = customer.getByRole("dialog", { name: /^Approve Quotation QUO-/ });
  expect((await new AxeBuilder({ page: customer }).analyze()).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Approve quote" }).click();
  await expect(dialog.getByText("Enter your name.")).toBeVisible();
  await expect(dialog.getByText("Tick the box to accept the quote's terms.")).toBeVisible();

  await dialog.getByLabel("Your name").fill("Juan Dela Cruz");
  await dialog.getByRole("checkbox", { name: "I accept this quote, including its terms." }).click();
  await dialog.getByRole("button", { name: "Approve quote" }).click();
  await expect(customer.locator("[data-sonner-toast]").filter({ hasText: /^You approved Quotation QUO-/ })).toBeVisible();
  await expect(customer.getByText(/^Approved by Juan Dela Cruz on /)).toBeVisible();
  await expect(customer.getByRole("button", { name: "Approve quote" })).toHaveCount(0);
  await customer.context().close();

  await page.reload();
  await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/^Approved by Juan Dela Cruz · /)).toBeVisible();
});

test("the customer can decline with a reason", async ({ browser }) => {
  test.slow(); // two browsers, and a full dev run compiles pages under load
  const { url, link } = await sendByLink();
  const customer = await (await browser.newContext()).newPage();
  await customer.goto(link);
  await customer.getByRole("button", { name: "Decline" }).click();
  const dialog = customer.getByRole("dialog", { name: /^Decline Quotation QUO-/ });
  await dialog.getByLabel("Reason").fill("Found a cheaper option");
  await dialog.getByRole("button", { name: "Decline quote" }).click();
  await expect(customer.getByText(/^You declined this quote on /)).toBeVisible();
  await customer.context().close();

  await page.goto(url);
  await expect(page.getByText("Declined", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/^Declined · .*Found a cheaper option/)).toBeVisible();
});
