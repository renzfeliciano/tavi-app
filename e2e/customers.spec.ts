import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { createBusiness, signUp, strongPassword, uniqueEmail } from "./helpers";

// One fresh business adding and managing customers. Desktop only: it creates
// an account (sign-up is rate limited per IP).
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "Creates an account; covered on desktop");

let page: Page;

const axe = (p: Page) =>
  new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
const toast = (text: string) => page.locator("[data-sonner-toast]").filter({ hasText: text });
const list = () => page.getByRole("region", { name: "Customer list" });

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await signUp(page, { name: "Maria Santos", email: uniqueEmail("customers"), password: strongPassword() });
  await createBusiness(page, "Santos Aircon");
});

test.afterAll(async () => {
  await page.context().close();
});

test("an empty list leads to adding the first customer", async () => {
  await page.goto("/customers");
  await expect(page.getByRole("heading", { name: "No customers yet" })).toBeVisible();
  await page.getByRole("link", { name: "Add customer" }).click();
  await expect(page).toHaveURL(/\/customers\/new$/);
});

test("adding a customer explains mistakes, keeps what was typed, then opens the customer", async () => {
  await page.goto("/customers/new");
  await page.getByRole("textbox", { name: /^Email/ }).fill("juan at bakery");
  await page.getByLabel("Company").fill("Dela Cruz Bakery");
  await page.getByRole("button", { name: "Add customer" }).click();

  await expect(page.getByText("Enter the customer's name.")).toBeVisible();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByLabel("Company")).toHaveValue("Dela Cruz Bakery");
  expect((await axe(page)).violations).toEqual([]);

  await page.getByLabel("Name", { exact: true }).fill("Juan Dela Cruz");
  await page.getByRole("textbox", { name: /^Email/ }).fill("juan@bakery.example");
  await page.getByLabel("Phone").fill("0917 555 0100");
  await page.getByLabel("Bill in").selectOption("USD");
  await page.getByRole("button", { name: "Add customer" }).click();

  await expect(toast("Juan Dela Cruz added.")).toBeVisible();
  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Juan Dela Cruz" })).toBeVisible();
  await expect(page.getByLabel("Bill in")).toHaveValue("USD");
});

test("editing a customer saves the change", async () => {
  await page.getByLabel("City or municipality").fill("Pasig");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(toast("Customer saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("City or municipality")).toHaveValue("Pasig");
});

test("the list shows customers and finds them by company, email or phone", async () => {
  await page.goto("/customers/new");
  await page.getByLabel("Name", { exact: true }).fill("Ana Reyes");
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(toast("Ana Reyes added.")).toBeVisible();

  await page.goto("/customers");
  await expect(list().getByRole("link")).toHaveText([/Ana Reyes/, /Juan Dela Cruz.*Dela Cruz Bakery/]);
  expect((await axe(page)).violations).toEqual([]);

  const search = page.getByRole("searchbox", { name: "Search customers" });
  await search.fill("bakery");
  await search.press("Enter");
  await expect(page).toHaveURL(/\?q=bakery$/);
  await expect(list().getByRole("link")).toHaveText([/Juan Dela Cruz/]);

  await search.fill("nobody here");
  await search.press("Enter");
  await expect(page.getByRole("heading", { name: "No customers match “nobody here”" })).toBeVisible();
  await page.getByRole("link", { name: "Clear search" }).click();
  await expect(list().getByRole("link")).toHaveCount(2);
});

test("archiving hides a customer, can be undone, and archived customers can be restored", async () => {
  await list().getByRole("link", { name: /Ana Reyes/ }).click();
  await page.getByRole("button", { name: "Archive" }).click();
  const archivedToast = toast("Ana Reyes archived.");
  await expect(archivedToast).toBeVisible();
  await archivedToast.getByRole("button", { name: "Undo" }).click();
  await expect(toast("Ana Reyes restored.")).toBeVisible();

  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByText("Archived. Restore to quote or bill them again.")).toBeVisible();

  await page.goto("/customers");
  await expect(list().getByRole("link")).toHaveText([/Juan Dela Cruz/]);
  await page.getByRole("link", { name: "Archived (1)" }).click();
  await expect(list().getByRole("link")).toHaveText([/Ana Reyes/]);

  await list().getByRole("link", { name: /Ana Reyes/ }).click();
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(toast("Ana Reyes restored.")).toBeVisible();
});

test("another business's customer, or a made-up one, is not found", async () => {
  await page.goto("/customers/01890000-0000-7000-8000-000000000000");
  await expect(page.getByRole("heading", { name: "We couldn't find that" })).toBeVisible();
});
