import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { asVisitor, createBusiness, signUp, strongPassword, tableRows, uniqueEmail } from "./helpers";

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
  // The tabs follow the page's title, Products & Services, and an empty catalog opens on the first.
  await page.goto("/catalog");
  await expect(page.getByRole("link", { name: "Products", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "No products yet" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Catalog lists" }).getByRole("link")).toHaveText(["Products", "Services"]);
  await page.getByRole("link", { name: "Services", exact: true }).click();
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
  // Both have items, so it opens on Products, the first tab.
  await page.goto("/catalog");
  const products = tableRows(page, "Products list");
  await expect(products.filter({ hasText: "Coil cleaner" })).toContainText("CC-500");
  await expect(page.getByRole("link", { name: "Products", exact: true })).toHaveAttribute("aria-current", "page");
  expect((await axe(page)).violations).toEqual([]);

  await page.getByRole("link", { name: "Services", exact: true }).click();
  const services = tableRows(page, "Services list");
  await expect(services.filter({ hasText: "Aircon cleaning" })).toContainText("₱1,500.00");
  await expect(services.filter({ hasText: "Aircon cleaning" })).toContainText("per unit");

  await page.getByRole("link", { name: "Products", exact: true }).click();
  const search = page.getByRole("searchbox", { name: "Search products" });
  await search.fill("cc-5");
  await search.press("Enter");
  await expect(page).toHaveURL(/[?&]q=cc-5/);
  await expect(page).toHaveURL(/[?&]type=products/);
  await expect(products).toHaveText([/Coil cleaner/]);
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

test("an item can be saved without a price, and is priced on the line when it goes on a quote", async () => {
  await page.goto("/catalog/services/new");
  await expect(page.getByLabel("Price per unit")).toHaveAccessibleDescription(
    /Leave it blank if you don't know it yet/,
  );
  await page.getByLabel("Name", { exact: true }).fill("Site inspection");
  await page.getByRole("button", { name: "Add service" }).click();
  await expect(toast("Site inspection added.")).toBeVisible();
  await expect(page).toHaveURL(/\/catalog\/services\/[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Price per unit")).toHaveValue("");

  // The list says the price isn't known yet, rather than showing an amount. (The only product was archived above,
  // so the page opens on Services, the tab that has something in it.)
  await page.goto("/catalog");
  const row = tableRows(page, "Services list").filter({ hasText: "Site inspection" });
  await expect(row).toContainText("No price yet");
  await expect(row).toContainText("per hour");
  await expect(row).not.toContainText("₱");
  expect((await axe(page)).violations).toEqual([]);

  // On a quote it is offered like any item, and the line is left for the owner to price.
  await page.goto("/quotes/new");
  await page.getByRole("combobox", { name: "Add from Products & Services", exact: true }).fill("inspection");
  // Only what was typed, not the whole price list.
  await expect(page.getByRole("option")).toHaveCount(1);
  const option = page.getByRole("option", { name: /Site inspection/ });
  await expect(option).toContainText("No price yet");
  await option.click();
  await expect(toast("Site inspection has no price yet. Enter it on the line.")).toBeVisible();
  await expect(page.getByLabel("Line 1 description")).toHaveValue("Site inspection");
  await expect(page.getByLabel("Price (PHP)")).toHaveValue("");
  await page.getByLabel("Price (PHP)").fill("2,000");
  await expect(page.getByLabel("Price (PHP)")).toHaveValue("2,000");
});

test("each business has its own price list, and switching shows it at once without a reload", async () => {
  const sidebar = page.locator("#app-sidebar");
  const currentBusiness = () => sidebar.getByRole("button", { name: /Santos Aircon|Second Shop/ }).first();
  const switchTo = async (name: string) => {
    await currentBusiness().click();
    await page.getByRole("menuitem", { name: new RegExp(name) }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    // The sidebar belongs to the page's layout; it must follow the switch rather than keep the old name.
    await expect(currentBusiness()).toContainText(name);
  };
  const services = page.getByRole("region", { name: "Services list" });

  // Santos Aircon has services from the tests above (and no products, so the page opens on Services). Look at its
  // list first, so the page is in the router's cache.
  await page.goto("/catalog");
  await expect(services.getByRole("link", { name: /Site inspection/ })).toBeVisible();

  // A second business starts empty.
  await currentBusiness().click();
  await page.getByRole("menuitem", { name: /Add business/ }).click();
  await expect(page).toHaveURL(/\/onboarding\?new=1$/);
  await createBusiness(page, "Second Shop");
  await expect(currentBusiness()).toContainText("Second Shop");
  await sidebar.getByRole("link", { name: /^Products & Services/ }).click();
  await expect(page.getByRole("heading", { name: "No products yet" })).toBeVisible();
  await expect(services.getByRole("link", { name: /Site inspection/ })).toHaveCount(0);

  // Back to the first one: its sidebar name and its own list, with no page reload in between.
  await page.evaluate(() => Object.assign(window, { sameDocument: true }));
  await switchTo("Santos Aircon");
  await sidebar.getByRole("link", { name: /^Products & Services/ }).click();
  await expect(services.getByRole("link", { name: /Site inspection/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No products yet" })).toHaveCount(0);

  // And forth again: the empty list must not be the cached copy of Santos Aircon's.
  await switchTo("Second Shop");
  await sidebar.getByRole("link", { name: /^Products & Services/ }).click();
  await expect(page.getByRole("heading", { name: "No products yet" })).toBeVisible();
  expect(await page.evaluate(() => "sameDocument" in window)).toBe(true);
});
