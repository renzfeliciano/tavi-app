import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { asVisitor, createBusiness, markEmailVerified, signUp, strongPassword, tableRows, uniqueEmail } from "./helpers";

// What the Products & Services lists say of each item's use: when it was last put on a sent quotation or an issued
// billing statement and how often, and a product's SKU under its name on a phone. One fresh business with real
// documents (written, sent and issued through the screens). Desktop only (see ACCOUNT_CREATING_SPECS in
// playwright.config.ts); the phone layout is checked by resizing the window.
test.use({ storageState: { cookies: [], origins: [] }, ...asVisitor("catalog-usage") });
test.describe.configure({ mode: "serial" });
test.slow();

let page: Page;
let juanId: string;

const axe = (p: Page) =>
  new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
const toast = (text: string | RegExp) => page.locator("[data-sonner-toast]").filter({ hasText: text });
const services = (name: string) => tableRows(page, "Services list").filter({ hasText: name });
const products = (name: string) => tableRows(page, "Products list").filter({ hasText: name });

async function addItem(kind: "service" | "product", fields: { name: string; price: string; sku?: string; description?: string }) {
  await page.goto(`/catalog/${kind}s/new`);
  await page.getByLabel("Name", { exact: true }).fill(fields.name);
  if (fields.description) await page.getByLabel("Description").fill(fields.description);
  if (fields.sku) await page.getByLabel("SKU").fill(fields.sku);
  await page.getByLabel("Price per unit").fill(fields.price);
  await page.getByRole("button", { name: `Add ${kind}` }).click();
  await expect(toast(`${fields.name} added.`)).toBeVisible();
}

/** Puts a product or service on the open document from the picker. Typed text is lost until the editor is ready, so try again until it takes. */
async function addFromCatalog(name: string) {
  const picker = page.getByRole("combobox", { name: "Add from Products & Services", exact: true });
  await expect(async () => {
    await picker.fill(name);
    await page.getByRole("option", { name: new RegExp(name) }).click({ timeout: 2_000 });
  }).toPass();
}

async function sendByEmail() {
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("dialog", { name: /^Send / }).getByRole("button", { name: "Send email" }).click();
  await expect(toast(/ sent to juan@example\.com\./)).toBeVisible();
}

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  const email = uniqueEmail("catalog-usage");
  await signUp(page, { name: "Maria Santos", email, password: strongPassword() });
  await createBusiness(page, "Santos Aircon");
  await markEmailVerified(email);
  await page.goto("/customers/new");
  await page.getByLabel("Name", { exact: true }).fill("Juan Dela Cruz");
  await page.getByRole("textbox", { name: /^Email/ }).fill("juan@example.com");
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(toast("Juan Dela Cruz added.")).toBeVisible();
  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]{36}$/);
  juanId = page.url().match(/\/customers\/([0-9a-f-]{36})$/)?.[1] ?? "";
  expect(juanId).not.toBe("");

  await addItem("service", { name: "Aircon cleaning", price: "1,500" });
  await addItem("service", { name: "Aircon repair", price: "2,500" });
  await addItem("product", { name: "Air filter", price: "800", sku: "AF-100", description: "Washable, fits split types" });
});

test.afterAll(async () => {
  await page.context().close();
});

test("an item nothing was sent with says it has never been used, and a draft doesn't change that", async () => {
  await page.goto(`/quotes/new?customer=${juanId}`);
  await addFromCatalog("Aircon cleaning");
  await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("status").filter({ hasText: /^\s*Saved$/ })).toBeVisible();

  await page.goto("/catalog?type=services");
  await expect(services("Aircon cleaning")).toContainText("Never used");
  await expect(services("Aircon repair")).toContainText("Never used");
  await expect(page.getByRole("columnheader", { name: "Last used" })).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);
});

test("sending the quotation counts it: used today, once", async () => {
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: /^Draft quotation$/ })).toBeVisible();
  await sendByEmail();

  await page.goto("/catalog?type=services");
  const cleaning = services("Aircon cleaning");
  await expect(cleaning).toContainText("Today");
  await expect(cleaning).toContainText("Used once");
  await expect(services("Aircon repair")).toContainText("Never used");
});

test("an issued billing statement counts too, across both kinds of document and across products", async () => {
  await page.goto(`/invoices/new?customer=${juanId}`);
  await addFromCatalog("Aircon cleaning");
  await expect(page.getByLabel("Line 1 description")).toHaveValue("Aircon cleaning");
  await addFromCatalog("Aircon repair");
  await expect(page.getByLabel("Line 2 description")).toHaveValue("Aircon repair");
  await addFromCatalog("Air filter");
  // A product's description comes with it, under its name.
  await expect(page.getByLabel("Line 3 description")).toHaveValue(/^Air filter/);
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}$/);
  await sendByEmail();

  await page.goto("/catalog?type=services");
  await expect(services("Aircon cleaning")).toContainText("Used 2 times");
  await expect(services("Aircon repair")).toContainText("Used once");
  await expect(services("Aircon repair")).toContainText("Today");

  await page.goto("/catalog?type=products");
  await expect(products("Air filter")).toContainText("Used once");
});

test("on a phone a product's SKU sits under its name, and the lists fit the screen", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  const sideways = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await page.goto("/catalog?type=products");
  const row = products("Air filter");
  const phoneSku = row.locator("span.md\\:hidden").filter({ hasText: "AF-100" });
  await expect(phoneSku).toBeVisible();
  await expect(row).toContainText("Washable, fits split types");
  await expect(page.getByRole("columnheader", { name: "Last used" })).toBeHidden();
  expect(await sideways()).toBe(false);
  expect((await axe(page)).violations).toEqual([]);

  // From a tablet width up the SKU has a column of its own, so it isn't said twice.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(phoneSku).toBeHidden();
  await expect(row.getByText("AF-100", { exact: true }).last()).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Last used" })).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);
});

test("while the list loads, its skeleton has the same columns where the real ones will be", async () => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/dashboard");
  const link = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Products & Services" });
  await expect(link).toBeVisible();
  // Resting on the link lets the router fetch the page's loading screen, as it does for a person about to click.
  await link.hover();
  await page.waitForLoadState("networkidle");
  let slow = true;
  await page.route("**/catalog**", async (route) => {
    // Hold back the page's own answer, not the router's prefetch of the loading screen that comes first.
    const { rsc, "next-router-prefetch": prefetch } = route.request().headers();
    if (slow && rsc === "1" && !prefetch) await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });

  await link.click();
  const skeleton = page.getByRole("status").filter({ hasText: "Loading products and services" });
  await expect(skeleton).toBeVisible();
  const headers = ["Product", "SKU", "Last used", "Price"];
  const waiting = new Map<string, { x: number; y: number; width: number }>();
  for (const header of headers) {
    const box = await skeleton.getByText(header, { exact: true }).first().boundingBox();
    if (!box) throw new Error(`no ${header} in the skeleton`);
    waiting.set(header, box);
  }
  await expect(skeleton).toBeHidden();
  slow = false;
  await expect(page.getByRole("columnheader", { name: "Last used" })).toBeVisible();
  for (const header of headers) {
    const box = await page.getByRole("columnheader", { name: header, exact: true }).boundingBox();
    const before = waiting.get(header);
    if (!box || !before) throw new Error(`no ${header} on the page`);
    expect(Math.abs(before.y - box.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(before.x - box.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(before.width - box.width)).toBeLessThanOrEqual(1);
  }
});
