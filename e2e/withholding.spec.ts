import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { asVisitor, createBusiness, markEmailVerified, signUp, strongPassword, tableRows, uniqueEmail } from "./helpers";

// A customer withholds tax and later sends the certificate (PH: BIR Form 2307): one business records a payment
// with tax withheld, sees it waiting for its 2307, records the certificate with a scan, finds it in Reports and
// its CSV, then voids it and sees the payment waiting again. Made-up names and numbers only. Desktop only (see
// ACCOUNT_CREATING_SPECS).
test.use({ storageState: { cookies: [], origins: [] }, ...asVisitor("withholding") });
test.describe.configure({ mode: "serial" });
test.slow();

let context: BrowserContext;
let page: Page;
let certificateUrl: string;

const toast = (text: string | RegExp) => page.locator("[data-sonner-toast]").filter({ hasText: text });
const axe = (p: Page) =>
  new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("[data-sonner-toaster]").analyze();
const scrollsSideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

// A PDF is kept as it came, checked only by its first bytes, so a tiny one is enough for the scan.
const SCAN = {
  name: "2307-sample.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"),
};

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  page = await context.newPage();
  const email = uniqueEmail("withholding");
  await signUp(page, { name: "Maria Santos", email, password: strongPassword() });
  await createBusiness(page, "Santos Aircon");
  await markEmailVerified(email);
  await page.goto("/customers/new");
  await page.getByLabel("Name", { exact: true }).fill("Juan Dela Cruz");
  await page.getByRole("textbox", { name: /^Email/ }).fill("juan@example.com");
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(toast("Juan Dela Cruz added.")).toBeVisible();
});

test.afterAll(async () => {
  await context.close();
});

test("a payment with tax withheld waits for its 2307, in Payments and in Withholding", async () => {
  await page.goto("/invoices/new");
  await page.getByRole("combobox", { name: "Customer", exact: true }).fill("Juan");
  await page.getByRole("option", { name: /Juan Dela Cruz/ }).click();
  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByLabel("Line 1 description").fill("Aircon cleaning");
  await page.getByLabel("Price (PHP)").first().fill("2,000");
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const send = page.getByRole("dialog", { name: /^Send / });
  await send.getByLabel("Copy link").check();
  await send.getByRole("button", { name: "Mark as sent and copy link" }).click();
  await expect(toast(/is ready\. Link copied\./)).toBeVisible();

  await page.getByRole("button", { name: "Record payment" }).click();
  const dialog = page.getByRole("dialog", { name: "Record a payment" });
  await dialog.getByLabel("Amount received (PHP)").fill("1,960");
  await dialog.getByLabel("Tax withheld (BIR Form 2307)").fill("40");
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(toast(/Payment recorded on/)).toBeVisible();
  // On the statement, the payment says where its certificate stands.
  await expect(page.getByText("2307 pending").first()).toBeVisible();

  await page.goto("/payments");
  await expect(page.getByRole("link", { name: "2307 pending", exact: true })).toBeVisible();
  await expect(tableRows(page, "Payment list")).toHaveCount(1);
  await expect(tableRows(page, "Payment list").first()).toContainText("2307 pending");
  await page.getByRole("link", { name: "2307 pending", exact: true }).click();
  await expect(page).toHaveURL(/withholding=pending/);
  await expect(tableRows(page, "Payment list")).toHaveCount(1);

  await page.getByRole("link", { name: "Withholding (2307)" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Withholding (2307)" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Waiting for a 2307" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("#main")).toContainText("Juan Dela Cruz");
  await expect(page.locator("#main")).toContainText("₱40.00");
  expect((await axe(page)).violations).toEqual([]);
});

test("recording the certificate: the payment is ticked, the tax matches, and a scan goes with it", async () => {
  await page.goto("/payments/withholding");
  await page.getByRole("link", { name: /Juan Dela Cruz/ }).first().click();
  await expect(page).toHaveURL(/\/payments\/withholding\/new\?customer=/);
  await expect(page.getByRole("heading", { level: 1, name: "Record a 2307" })).toBeVisible();

  // Nothing is typed yet, so the check against the ticked payment shows the full difference.
  await expect(page.getByRole("checkbox", { name: /REC-000001/ })).toBeChecked();
  await expect(page.getByRole("status", { name: "Comparison with payments" })).toContainText("Differs by ₱40.00");

  // Problems show beside their fields, and the first one takes focus.
  await page.getByRole("button", { name: "Save 2307" }).click();
  await expect(page.getByLabel(/^Payor's TIN/)).toBeFocused();
  await expect(page.getByText("Enter the payor's TIN as written on the form: at least 9 digits.")).toBeVisible();

  await page.getByLabel(/^Payor's TIN/).fill("123-456-789-00000");
  await expect(page.getByLabel(/^Payor's name/)).toHaveValue("Juan Dela Cruz");
  await page.getByLabel(/^ATC$/).selectOption("WI160");
  await expect(page.getByLabel("Rate (%)")).toHaveValue("2");
  await page.locator("#line-0-month1").fill("2,000");
  await expect(page.getByText("Total income payments ₱2,000.00")).toBeVisible();
  await expect(page.getByLabel(/^Tax withheld/)).toHaveValue("40.00");
  await expect(page.getByRole("status", { name: "Comparison with payments" })).toContainText("Matches");
  await page.locator('input[type="file"]').setInputFiles(SCAN);
  await expect(page.getByText(SCAN.name)).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);

  await page.getByRole("button", { name: "Save 2307" }).click();
  await expect(toast("2307 recorded.")).toBeVisible();
  await expect(page).toHaveURL(/\/payments\/withholding\/[0-9a-f-]{36}$/);
  certificateUrl = page.url();
  await expect(page.getByRole("heading", { level: 1, name: "2307 from Juan Dela Cruz" })).toBeVisible();
  await expect(page.locator("#main")).toContainText("123-456-789-00000");
  await expect(page.locator("#main")).toContainText("Matches the tax withheld on the 1 payment on it.");
  await expect(page.getByRole("link", { name: SCAN.name })).toHaveAttribute("href", /^\/api\/files\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("link", { name: "REC-000001" })).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);
});

test("the certificate and the form read well in dark mode and on a phone", async () => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(certificateUrl);
  expect((await axe(page)).violations).toEqual([]);
  await page.goto(`${certificateUrl}/edit`);
  await expect(page.getByRole("heading", { level: 1, name: "Edit 2307" })).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);
  await page.emulateMedia({ colorScheme: "light" });

  await page.setViewportSize({ width: 360, height: 800 });
  for (const path of ["/payments/withholding", "/payments/withholding?view=received", certificateUrl, `${certificateUrl}/edit`, "/reports"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await scrollsSideways(page), `${path} scrolls sideways at 360px`).toBe(false);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
});

test("the payment now shows its 2307 as received, and an edit can correct the certificate", async () => {
  await page.goto("/payments");
  await expect(tableRows(page, "Payment list").first()).toContainText("2307 received");
  await page.goto("/payments/withholding?view=received");
  await expect(page.locator("#main")).toContainText("Dela Cruz");

  await page.goto(`${certificateUrl}/edit`);
  await page.getByLabel(/^Payor's address/).fill("123 Rizal Street");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(toast("2307 saved.")).toBeVisible();
  await expect(page.locator("#main")).toContainText("123 Rizal Street");
});

test("Reports add the quarter up by payor, and the CSV has the same rows", async () => {
  await page.goto("/reports");
  const section = page.getByRole("region", { name: "Creditable tax withheld (2307)" });
  await expect(section).toContainText("Juan Dela Cruz · TIN 123-456-789-00000");
  await expect(section).toContainText("WI160");
  await expect(section).toContainText("₱40.00");
  await expect(section).not.toContainText("Still waiting for 2307");
  expect((await axe(page)).violations).toEqual([]);

  const [download] = await Promise.all([page.waitForEvent("download"), section.getByRole("link", { name: /Download CSV/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/^withholding-\d{4}-Q[1-4]\.csv$/);
  const csv = Buffer.concat(await (await download.createReadStream()).toArray())
    .toString("utf8")
    .split("\r\n");
  expect(csv[0]).toContain("Quarter,Status,Payor TIN,Payor name,Received on,ATC,Rate %");
  expect(csv[1]).toContain(",Received,123-456-789-00000,Juan Dela Cruz,");
  expect(csv[1]).toContain(",WI160,2.00,");
  expect(csv[1]).toContain(",40.00,INV-000001,Yes,PHP");
});

test("voiding the certificate keeps it on the record and puts the payment back to pending", async () => {
  await page.goto(certificateUrl);
  await page.getByRole("button", { name: "Void" }).click();
  const dialog = page.getByRole("dialog", { name: "Void this 2307?" });
  await expect(dialog).toContainText('The payment on it goes back to "2307 pending"');
  await dialog.getByRole("button", { name: "Void 2307" }).click();
  await expect(dialog.getByText("Give a reason. It's kept with the record.")).toBeVisible();
  await dialog.getByLabel("Reason").fill("Recorded under the wrong customer.");
  await dialog.getByRole("button", { name: "Void 2307" }).click();
  await expect(toast("2307 voided.")).toBeVisible();
  await expect(page.getByRole("note", { name: "Void" })).toContainText("Recorded under the wrong customer.");
  await expect(page.getByRole("button", { name: "Void" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);

  await page.goto("/payments");
  await expect(tableRows(page, "Payment list").first()).toContainText("2307 pending");
  await page.goto("/payments/withholding?view=void");
  await expect(page.locator("#main")).toContainText("Void");
  await page.goto("/payments/withholding");
  await expect(page.locator("#main")).toContainText("Juan Dela Cruz");
});

test("the owner deletes the void 2307 into the recycle bin, and restoring brings it back void", async () => {
  await page.goto(certificateUrl);
  await page.locator("#main").getByRole("button", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /^Delete 2307 from / });
  await expect(dialog).toContainText("scan is deleted with it");
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(toast(/moved to the recycle bin/)).toBeVisible();
  await expect(page).toHaveURL(/\/payments\/withholding$/);

  await page.goto("/recycle-bin");
  const row = page.locator("#main").getByRole("listitem").filter({ hasText: "BIR Form 2307" });
  await expect(row).toContainText(/Q\d \d{4}/);
  await expect(row).toContainText("Juan Dela Cruz");
  await row.getByRole("button", { name: "Restore" }).click();
  await expect(toast(/restored\./)).toBeVisible();
  await page.goto(certificateUrl);
  await expect(page.getByRole("note", { name: "Void" })).toContainText("Recorded under the wrong customer.");
});

test("the owner deletes a void payment into the recycle bin, and restoring brings it back void", async () => {
  await page.goto("/invoices");
  await page.getByRole("link", { name: /INV-000001/ }).click();
  await page.getByRole("button", { name: "Void" }).last().click();
  const voidDialog = page.getByRole("dialog", { name: /^Void payment / });
  await voidDialog.getByLabel("Reason").fill("Entered twice");
  await voidDialog.getByRole("button", { name: "Void payment" }).click();
  await expect(toast(/Payment .* voided\./)).toBeVisible();

  await page.getByRole("link", { name: /^Payment acknowledgement / }).first().click();
  await page.locator("#main").getByRole("button", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /^Delete Payment acknowledgement / });
  await expect(dialog).toContainText("balance doesn't change");
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(toast(/moved to the recycle bin/)).toBeVisible();
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}$/);

  await page.goto("/recycle-bin");
  const row = page.locator("#main").getByRole("listitem").filter({ hasText: "Payment acknowledgement" });
  await expect(row).toContainText("Juan Dela Cruz");
  expect((await axe(page)).violations).toEqual([]);
  await row.getByRole("button", { name: "Restore" }).click();
  await expect(toast(/restored\./)).toBeVisible();
});
