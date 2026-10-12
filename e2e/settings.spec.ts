import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import QRCode from "qrcode";
import sharp from "sharp";
import { asVisitor, createBusiness, signUp, strongPassword, uniqueEmail } from "./helpers";

// One fresh business, set up step by step like a new owner would. Desktop
// only (see ACCOUNT_CREATING_SPECS in playwright.config.ts): it creates an
// account, and sign-up is rate limited per IP.
test.use({ storageState: { cookies: [], origins: [] }, ...asVisitor("settings") });
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
  // Settings lives in the account menu at the foot of the sidebar, not in the nav.
  await page.getByRole("button", { name: /Maria Santos/ }).click();
  await page.getByRole("link", { name: "Settings" }).click();
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
  await page.getByLabel("Tax registration").selectOption({ label: "VAT-registered" });
  await page.getByLabel("Quotes are valid for").fill("14");
  await page.getByLabel("City or municipality").fill("Quezon City");
  await page.getByLabel("Tax is added on top").check();
  await page.getByLabel("How to pay you").fill("GCash 0917 555 0100 (Maria S.)");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(toast("Business profile saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Registered name")).toHaveValue("Santos Aircon Services OPC");
  await expect(page.getByLabel("TIN")).toHaveValue("123-456-789-00000");
  await expect(page.getByLabel("Tax registration")).toHaveValue("vat");
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
  // The chosen file is previewed first; nothing is saved until the person confirms.
  await expect(page.getByTestId("logo-preview").getByRole("img", { name: "Santos Aircon logo" })).toBeVisible();
  await page.getByRole("button", { name: "Save logo" }).click();
  await expect(toast("Logo updated.")).toBeVisible();
  const logo = page.getByRole("img", { name: "Santos Aircon logo" });
  await expect(logo).toBeVisible();
  // Visible comes before decoded, so wait for the picture itself.
  await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(600);

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


test("payment QR codes: reads a screenshot, previews it, saves and keeps it", async () => {
  await page.goto("/settings/business");
  const link = "https://pay.example/santos-aircon";
  const screenshot = await QRCode.toBuffer(link, { type: "png", width: 400, margin: 4 });

  await page.getByRole("button", { name: "Add a QR code" }).click();
  await page.getByLabel("Name", { exact: true }).fill("GCash");
  // Go through the "Upload screenshot" button, as a person does: it records which QR the file is for.
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload screenshot" }).click();
  await (await chooser).setFiles({ name: "gcash.png", mimeType: "image/png", buffer: screenshot });
  // The screenshot is read in the browser; only its text lands in the field.
  await expect(page.getByLabel("Payment link or QR code text")).toHaveValue(link);
  await expect(page.getByRole("img", { name: "GCash QR code" })).toBeVisible();

  await page.getByRole("button", { name: "Save QR codes" }).click();
  await expect(toast("Payment QR codes saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Payment link or QR code text")).toHaveValue(link);
  await expect(page.getByRole("img", { name: "GCash QR code" })).toBeVisible();

  // A bad link is refused next to the field, and nothing is saved.
  await page.getByLabel("Payment link or QR code text").fill("http://not-secure.example");
  await page.getByRole("button", { name: "Save QR codes" }).click();
  await expect(page.getByText(/starts with https/)).toBeVisible();
});

test("logo: a very wide logo is fitted inside its preview box and can be cancelled", async () => {
  await page.goto("/settings/business");
  const wide = await sharp({
    create: { width: 1200, height: 40, channels: 4, background: { r: 60, g: 40, b: 160, alpha: 1 } },
  })
    .png()
    .toBuffer();
  await page.locator('input[type="file"][name="logo"]').setInputFiles({ name: "wide.png", mimeType: "image/png", buffer: wide });

  const box = page.getByTestId("logo-preview");
  const img = box.getByRole("img", { name: "Santos Aircon logo" });
  await expect(img).toBeVisible();
  const [boxBounds, imgBounds] = [await box.boundingBox(), await img.boundingBox()];
  expect(boxBounds && imgBounds).toBeTruthy();
  expect(imgBounds!.x).toBeGreaterThanOrEqual(boxBounds!.x);
  expect(imgBounds!.x + imgBounds!.width).toBeLessThanOrEqual(boxBounds!.x + boxBounds!.width + 0.5);
  expect(await box.evaluate((el: HTMLElement) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(page.getByRole("status").filter({ hasText: "very wide" })).toBeVisible();

  await page.getByRole("button", { name: "Cancel" }).click();
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

test("theme: dark applies at once, survives a reload, and System goes back to the browser's choice", async () => {
  await page.goto("/settings");
  const html = page.locator("html");
  // The theme switch lives in the account menu at the foot of the sidebar; it stays open after a choice.
  const choose = async (name: string) => {
    const theme = page.getByRole("radiogroup", { name: "Theme" });
    if (!(await theme.isVisible())) await page.getByRole("button", { name: /Maria Santos/ }).click();
    await theme.getByRole("radio", { name }).click();
  };

  await choose("Dark");
  await expect(html).toHaveAttribute("data-theme", "dark");
  // The page shows dark at once; the choice is saved a moment later. Wait for the saved cookie so the reload can't cut it off.
  await expect
    .poll(async () => (await page.context().cookies()).find((c) => c.name === "tavi-theme")?.value)
    .toBe("dark");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  expect((await axe(page)).violations).toEqual([]);

  await choose("System");
  await expect(html).not.toHaveAttribute("data-theme", /.+/);
  await choose("Light");
  await expect(html).toHaveAttribute("data-theme", "light");
});
