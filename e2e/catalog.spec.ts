import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { asVisitor, createBusiness, signUp, strongPassword, uniqueEmail } from "./helpers";

// One fresh business building its price list. Desktop only (see
// ACCOUNT_CREATING_SPECS in playwright.config.ts): sign-up is rate limited per IP.
test.use({ storageState: { cookies: [], origins: [] }, ...asVisitor("catalog") });
test.describe.configure({ mode: "serial" });

let page: Page;

const axe = (p: Page) =>
  new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
const toast = (text: string) => page.locator("[data-sonner-toast]").filter({ hasText: text });

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await signUp(page, { name: "Maria Santos", email: uniqueEmail("catalog"), password: strongPassword() });
  await createBusiness(page, "Santos Aircon");
  // A default tax rate, so new items start with it.
  await page.goto("/settings/tax-rates");
  await page.getByRole("button", { name: /^Add VAT/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Add tax" }).click();
  await expect(toast("VAT added.")).toBeVisible();
});

test.afterAll(async () => {
  await page.context().close();
});

test("adding a service: explains a price it can't read, then saves it with the market's defaults", async () => {
  await page.goto("/catalog");
  await expect(page.getByRole("heading", { name: "No services yet" })).toBeVisible();
  await page.getByRole("link", { name: "Add service" }).first().click();
  await expect(page).toHaveURL(/\/catalog\/services\/new$/);

  // New services start in the business's currency, with its default tax and the market's usual unit.
  await expect(page.getByLabel("Currency")).toHaveValue("PHP");
  await expect(page.getByLabel("Unit", { exact: true })).toHaveValue("hour");
  await expect(page.getByLabel("Tax", { exact: true })).not.toHaveValue("");

  await page.getByLabel("Name", { exact: true }).fill("Aircon cleaning");
  await page.getByLabel("Price per unit").fill("1,500.555");
  await page.getByRole("button", { name: "Add service" }).click();
  await expect(page.getByText("Enter a price like 1,250.50.")).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Aircon cleaning");
  expect((await axe(page)).violations).toEqual([]);

  await page.getByLabel("Price per unit").fill("1,500");
  await page.getByLabel("Unit", { exact: true }).selectOption("unit");
  await page.getByRole("button", { name: "Add service" }).click();
  await expect(toast("Aircon cleaning added.")).toBeVisible();
  await expect(page).toHaveURL(/\/catalog\/services\/[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Price per unit")).toHaveValue("1,500.00");
});

test("adding a product with a SKU, and refusing the same SKU twice", async () => {
  await page.goto("/catalog/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Coil cleaner");
  await page.getByLabel("SKU").fill("CC-500");
  await page.getByLabel("Price per unit").fill("450");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(toast("Coil cleaner added.")).toBeVisible();

  await page.goto("/catalog/products/new");
  await page.getByLabel("Name", { exact: true }).fill("Another cleaner");
  await page.getByLabel("SKU").fill("cc-500");
  await page.getByLabel("Price per unit").fill("300");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByText("Another product already uses SKU cc-500.")).toBeVisible();
});

test("the two lists show prices per unit and find items", async () => {
  await page.goto("/catalog");
  const services = page.getByRole("region", { name: "Services list" });
  await expect(services.getByRole("link", { name: /Aircon cleaning/ })).toContainText("₱1,500.00");
  await expect(services.getByRole("link", { name: /Aircon cleaning/ })).toContainText("per unit");
  expect((await axe(page)).violations).toEqual([]);

  await page.getByRole("link", { name: "Products", exact: true }).click();
  const products = page.getByRole("region", { name: "Products list" });
  await expect(products.getByRole("link", { name: /Coil cleaner/ })).toContainText("CC-500");

  const search = page.getByRole("searchbox", { name: "Search products" });
  await search.fill("cc-5");
  await search.press("Enter");
  await expect(page).toHaveURL(/[?&]q=cc-5/);
  await expect(page).toHaveURL(/[?&]type=products/);
  await expect(products.getByRole("link")).toHaveText([/Coil cleaner/]);
});

test("editing and archiving an item", async () => {
  await page.goto("/catalog?type=products");
  await page.getByRole("link", { name: /Coil cleaner/ }).click();
  await page.getByLabel("Price per unit").fill("475.50");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(toast("Product saved.")).toBeVisible();

  await page.getByRole("button", { name: "Archive" }).click();
  await expect(toast("Coil cleaner archived.")).toBeVisible();
  await page.goto("/catalog?type=products");
  await expect(page.getByRole("heading", { name: "No products yet" })).toBeVisible();
  await page.getByRole("link", { name: "Archived (1)" }).click();
  await expect(page.getByRole("region", { name: "Products list" })).toContainText("₱475.50");
});
