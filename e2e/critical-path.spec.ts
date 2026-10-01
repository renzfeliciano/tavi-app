import { randomBytes } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page, test } from "@playwright/test";

// The critical path (§M 1.11, §G), end to end, on desktop and on a phone:
// customer → quote → sent by link → the customer approves → billing statement
// → sent → the customer sees what to pay → payment recorded → the customer
// sees it paid and downloads the acknowledgement. Runs as the shared owner
// (auth.setup.ts), so it adds no sign-ups and runs on both projects; each run
// uses its own customer, and documents are found by that name, not by number.
test.use({ permissions: ["clipboard-read", "clipboard-write"] });

// Toasts are left out: this walk runs axe right after actions, while toasts
// are still fading in or stacked behind each other, which reads as low
// contrast mid-animation. Settled toasts are checked by the specs that own them.
const axe = (p: Page) =>
  new AxeBuilder({ page: p })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .exclude("[data-sonner-toaster]")
    .analyze();

const scrollsSideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

async function expectUsable(p: Page) {
  expect((await axe(p)).violations).toEqual([]);
  expect(await scrollsSideways(p)).toBe(false);
}

/** Customers often open links on small, cheap phones: the page must still fit at 320px. */
async function expectFitsSmallPhone(p: Page) {
  const size = p.viewportSize();
  await p.setViewportSize({ width: 320, height: 640 });
  expect(await scrollsSideways(p)).toBe(false);
  if (size) await p.setViewportSize(size);
}

/** A customer's browser: same device as the project, no session. */
async function customerPage(browser: Browser): Promise<Page> {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = test.info().project.use;
  const context = await browser.newContext({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
  return context.newPage();
}

test("a quote becomes a paid billing statement, and the customer sees each step", async ({ page, browser }) => {
  test.setTimeout(test.info().timeout * 6);
  const toast = (text: string | RegExp) => page.locator("[data-sonner-toast]").filter({ hasText: text });
  const customerName = `Rosa ${randomBytes(3).toString("hex")} Reyes`;

  await test.step("add the customer", async () => {
    await page.goto("/customers/new");
    await page.getByLabel("Name", { exact: true }).fill(customerName);
    await page.getByRole("textbox", { name: /^Email/ }).fill("rosa@example.com");
    await page.getByRole("button", { name: "Add customer" }).click();
    await expect(toast(`${customerName} added.`)).toBeVisible();
  });

  const sendByLink = async (): Promise<string> => {
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: /^Send / });
    await dialog.getByLabel("Copy link").check();
    await dialog.getByRole("button", { name: "Mark as sent and copy link" }).click();
    await expect(toast(/is ready\. Link copied\./)).toBeVisible();
    return page.evaluate(() => navigator.clipboard.readText());
  };

  let quoteUrl = "";
  let quoteLink = "";
  await test.step("write and send the quote", async () => {
    await page.goto("/quotes/new");
    await page.getByRole("combobox", { name: "Customer", exact: true }).fill(customerName);
    await page.getByRole("option", { name: new RegExp(customerName) }).click();
    await page.getByRole("button", { name: "Add a line" }).click();
    await page.getByLabel("Line 1 description").fill("Split-type aircon cleaning");
    await page.getByLabel("Price (PHP)").first().fill("2,500");
    await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}$/);
    quoteUrl = page.url();
    await expectUsable(page);
    quoteLink = await sendByLink();
    expect(quoteLink).toMatch(/\/q\/[\w-]{43}$/);
    await expect(page.getByText("Sent", { exact: true }).first()).toBeVisible();
  });

  await test.step("the customer approves it", async () => {
    const customer = await customerPage(browser);
    await customer.goto(quoteLink);
    await expect(customer.getByRole("article", { name: /^Quotation QUO-/ })).toContainText(customerName);
    await expectUsable(customer);
    await expectFitsSmallPhone(customer);
    await customer.getByRole("button", { name: "Approve quote" }).click();
    const dialog = customer.getByRole("dialog", { name: /^Approve / });
    await dialog.getByLabel("Your name").fill(customerName);
    await dialog.getByRole("checkbox", { name: "I accept this quote, including its terms." }).click();
    await dialog.getByRole("button", { name: "Approve quote" }).click();
    await expect(customer.getByText(new RegExp(`^Approved by ${customerName} on `))).toBeVisible();
    await customer.context().close();
  });

  let invoiceLink = "";
  await test.step("turn it into a billing statement and send it", async () => {
    await page.goto(quoteUrl);
    await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Create billing statement" }).click();
    await expect(toast(/^Draft billing statement created from Quotation QUO-/)).toBeVisible();
    await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}$/);
    await expect(page.getByLabel("Line 1 description")).toHaveValue("Split-type aircon cleaning");
    invoiceLink = await sendByLink();
    expect(invoiceLink).toMatch(/\/i\/[\w-]{43}$/);
    await expect(page.getByText("Unpaid", { exact: true }).first()).toBeVisible();
    await expectUsable(page);
  });

  await test.step("the customer sees what to pay", async () => {
    const customer = await customerPage(browser);
    await customer.goto(invoiceLink);
    await expect(customer.getByRole("region", { name: "Balance due" })).toContainText("₱2,500.00");
    await expect(customer.getByRole("article", { name: /^Billing statement INV-/ })).toContainText(customerName);
    await expectUsable(customer);
    await expectFitsSmallPhone(customer);
    await customer.context().close();
  });

  await test.step("record the payment in full", async () => {
    await page.getByRole("button", { name: "Record payment" }).click();
    const dialog = page.getByRole("dialog", { name: "Record a payment" });
    await expect(dialog.getByLabel("Amount received (PHP)")).toHaveValue("2,500.00");
    await dialog.getByLabel("Method").selectOption({ label: "GCash or Maya" });
    await expectUsable(page);
    await dialog.getByRole("button", { name: "Record payment" }).click();
    await expect(toast(/^Payment recorded on Billing statement INV-/)).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
  });

  await test.step("the customer sees it paid and downloads the acknowledgement", async () => {
    const customer = await customerPage(browser);
    await customer.goto(invoiceLink);
    await expect(customer.getByText("Paid", { exact: true }).first()).toBeVisible();
    await expectUsable(customer);
    const receipt = customer.getByRole("link", { name: /^Download Payment acknowledgement REC-\d+ as PDF$/ });
    const href = await receipt.getAttribute("href");
    expect(href).toMatch(/\/receipts\/REC-\d+\/pdf$/);
    const pdf = await customer.context().request.get(new URL(href ?? "", invoiceLink).toString());
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    await customer.context().close();
  });
});
