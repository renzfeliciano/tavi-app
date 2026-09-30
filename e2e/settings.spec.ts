import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import sharp from "sharp";
import { createBusiness, signUp, strongPassword, uniqueEmail } from "./helpers";

// One fresh business, set up step by step like a new owner would. Desktop
// only (see ACCOUNT_CREATING_SPECS in playwright.config.ts): it creates an
// account, and sign-up is rate limited per IP.
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

let page: Page;

const axe = (p: Page) =>
  new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();

// Scope by text: Next.js also renders a hidden role="alert" route announcer.
const toast = (text: string) => page.locator("[data-sonner-toast]").filter({ hasText: text });

test.beforeAll(async ({ browser }) => {
  // AxeBuilder needs a page from an explicit context.
  page = await (await browser.newContext()).newPage();
  await signUp(page, { name: "Maria Santos", email: uniqueEmail("settings"), password: strongPassword() });
  await createBusiness(page, "Santos Aircon");
});

test.afterAll(async () => {
  await page.context().close();
});

test("the dashboard and settings lead to the business profile", async () => {
  await page.getByRole("link", { name: "Add them now" }).click();
  await expect(page).toHaveURL(/\/settings\/business$/);
  await page.getByRole("link", { name: "Settings" }).filter({ visible: true }).last().click();
  await expect(page.getByRole("link", { name: /Business profile/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Tax rates/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Document numbers/ })).toBeVisible();
});

test("business profile: explains mistakes, then saves and keeps the details", async () => {
  await page.goto("/settings/business");
  await page.getByLabel("TIN").fill("12-34");
  await page.getByLabel("Quotes are valid for").fill("0");
  await page.getByLabel("Registered name").fill("Santos Aircon Services OPC");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("Enter your TIN like 123-456-789-00000.")).toBeVisible();
  await expect(page.getByText("Choose between 1 and 365 days.")).toBeVisible();
  // What was typed is kept.
  await expect(page.getByLabel("Registered name")).toHaveValue("Santos Aircon Services OPC");
  expect((await axe(page)).violations).toEqual([]);

  await page.getByLabel("TIN").fill("123-456-789-00000");
  await page.getByLabel("Quotes are valid for").fill("14");
  await page.getByLabel("City or municipality").fill("Quezon City");
  await page.getByLabel("Tax is added on top").check();
  await page.getByLabel("How to pay you").fill("GCash 0917 555 0100 (Maria S.)");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(toast("Business profile saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Registered name")).toHaveValue("Santos Aircon Services OPC");
  await expect(page.getByLabel("TIN")).toHaveValue("123-456-789-00000");
  await expect(page.getByLabel("Quotes are valid for")).toHaveValue("14");
  await expect(page.getByLabel("Tax is added on top")).toBeChecked();
  await expect(page.getByLabel("How to pay you")).toHaveValue("GCash 0917 555 0100 (Maria S.)");
});

test("logo: uploads, refuses an SVG, and can be removed", async () => {
  await page.goto("/settings/business");
  const png = await sharp({
    create: { width: 800, height: 300, channels: 4, background: { r: 60, g: 40, b: 160, alpha: 0.9 } },
  })
    .png()
    .toBuffer();
  const input = page.locator('input[type="file"][name="logo"]');

  await input.setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
  await expect(toast("Logo updated.")).toBeVisible();
  const logo = page.getByRole("img", { name: "Santos Aircon logo" });
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(600);

  await input.setInputFiles({
    name: "evil.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
  });
  await expect(page.getByText("Upload a PNG, JPG or WebP image.")).toBeVisible();
  await expect(logo).toBeVisible();

  await page.getByRole("button", { name: "Remove" }).click();
  await expect(toast("Logo removed.")).toBeVisible();
  await expect(page.getByText("No logo yet")).toBeVisible();
});

test("tax rates: add VAT as the default, refuse a duplicate, archive and restore", async () => {
  await page.goto("/settings/tax-rates");
  await expect(page.getByRole("heading", { name: "No taxes yet" })).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);

  await page.getByRole("button", { name: "Add VAT (12%)" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Name")).toHaveValue("VAT");
  await expect(dialog.getByLabel("Rate")).toHaveValue("12");
  expect((await axe(page)).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Add tax" }).click();
  await expect(toast("VAT added.")).toBeVisible();

  // Toasts are list items too, so look inside the list of rates.
  const vat = page.getByRole("region", { name: "In use" }).getByRole("listitem").filter({ hasText: "VAT" });
  await expect(vat).toContainText("12%");
  await expect(vat).toContainText("Default");

  await page.getByRole("button", { name: "Add tax" }).click();
  await dialog.getByLabel("Name").fill("vat");
  await dialog.getByLabel("Rate").fill("12.345");
  await dialog.getByRole("button", { name: "Add tax" }).click();
  await expect(dialog.getByText("Enter a percentage from 0 to 100, with up to 2 decimals.")).toBeVisible();
  await dialog.getByLabel("Rate").fill("5");
  await dialog.getByRole("button", { name: "Add tax" }).click();
  await expect(dialog.getByText("You already have a tax called vat.")).toBeVisible();
  await dialog.getByLabel("Name").fill("Local business tax");
  await dialog.getByRole("button", { name: "Add tax" }).click();
  await expect(toast("Local business tax added.")).toBeVisible();

  await page.getByRole("button", { name: "Actions for VAT" }).click();
  await page.getByRole("menuitem", { name: "Archive" }).click();
  await expect(toast("VAT archived.")).toBeVisible();
  const archived = page.getByRole("region", { name: "Archived" });
  await expect(archived).toContainText("VAT");

  await archived.getByRole("button", { name: "Restore" }).click();
  await expect(toast("VAT restored.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Archived" })).toHaveCount(0);
});

test("document numbers: preview while typing, save, and keep counting", async () => {
  await page.goto("/settings/numbering");
  const quotes = page.getByRole("region", { name: "Quotations" });
  await expect(quotes).toContainText("QUO-000001");

  await quotes.getByLabel("Prefix").fill("sa-q-");
  await quotes.getByLabel("Digits").selectOption("4");
  await expect(quotes).toContainText("SA-Q-0001");
  await quotes.getByRole("button", { name: "Save" }).click();
  await expect(toast("Quotations numbering saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("region", { name: "Quotations" }).getByLabel("Prefix")).toHaveValue("SA-Q-");
  await expect(page.getByRole("region", { name: "Quotations" })).toContainText("SA-Q-0001");

  await quotes.getByLabel("Prefix").fill("S Q");
  await quotes.getByRole("button", { name: "Save" }).click();
  await expect(quotes.getByText("Use up to 12 letters, digits or dashes.")).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);
});
