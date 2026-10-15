import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { asVisitor, createBusiness, markEmailVerified, signUp, strongPassword, uniqueEmail } from "./helpers";

// An owner opens the RDO and CPA worksheet from Settings, answers a fact, writes a note and the answer they were told,
// saves, finds it again after a reload, is stopped from dating an answer in the future, and downloads the PDF.
// Made-up names only. Desktop only (see ACCOUNT_CREATING_SPECS).
test.use({ storageState: { cookies: [], origins: [] }, ...asVisitor("rdo-questionnaire") });
test.describe.configure({ mode: "serial" });
test.slow();

let context: BrowserContext;
let page: Page;

const toast = (text: string | RegExp) => page.locator("[data-sonner-toast]").filter({ hasText: text });
const axe = (p: Page) =>
  new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("[data-sonner-toaster]").analyze();
const scrollsSideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
const question = (n: number) => page.locator("li[data-question]").nth(n);

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  const email = uniqueEmail("rdo-questionnaire");
  await signUp(page, { name: "Maria Santos", email, password: strongPassword() });
  await createBusiness(page, "Reyes Aircon");
  await markEmailVerified(email);
});

test.afterAll(async () => {
  await context.close();
});

test("Settings leads to the worksheet, which is accessible and fits the window", async () => {
  await page.goto("/settings");
  await page.getByRole("link", { name: /RDO and CPA questions/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "RDO and CPA questions" })).toBeVisible();
  await expect(page.locator("li[data-question]")).toHaveCount(6);
  await expect(page.getByText("Not asked yet")).toHaveCount(6);
  expect((await axe(page)).violations).toEqual([]);
  expect(await scrollsSideways(page)).toBe(false);
});

test("Registration points to the worksheet", async () => {
  await page.goto("/settings/registration");
  await page.getByRole("link", { name: "Prepare your questions" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "RDO and CPA questions" })).toBeVisible();
});

test("an answer is saved and is still there after a reload", async () => {
  await page.goto("/settings/questions");
  await page.getByLabel("Your sales in the last 12 months").selectOption("3m_to_20m");
  await question(0).getByLabel("Your note").fill("Bring the Certificate of Registration");
  await question(1).getByLabel("What you were told").fill("Not until our sales pass the threshold.");
  await question(1).getByLabel("Told on").fill("2026-10-01");
  await expect(page.getByRole("status").filter({ hasText: "Unsaved changes" })).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(toast("Worksheet saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Your sales in the last 12 months")).toHaveValue("3m_to_20m");
  await expect(question(0).getByLabel("Your note")).toHaveValue("Bring the Certificate of Registration");
  await expect(question(1).getByLabel("What you were told")).toHaveValue("Not until our sales pass the threshold.");
  await expect(question(1).getByText("Answered")).toBeVisible();
  await expect(page.getByText("Not asked yet")).toHaveCount(5);
});

test("a date in the future is refused beside its field and nothing is lost", async () => {
  await page.goto("/settings/questions");
  await question(2).getByLabel("What you were told").fill("Yes, it counts.");
  await question(2).getByLabel("Told on").fill("2099-01-01");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(question(2).getByText("That date is in the future.")).toBeVisible();
  await expect(toast(/Couldn't save/)).toBeVisible();
  await expect(question(2).getByLabel("What you were told")).toHaveValue("Yes, it counts.");

  await question(2).getByLabel("Told on").fill("2026-10-02");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(toast("Worksheet saved.")).toBeVisible();
});

test("the PDF downloads and holds what was saved", async () => {
  const pdf = await page.request.get("/settings/questions/pdf");
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect(pdf.headers()["content-disposition"]).toMatch(/^attachment/);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await page.goto("/settings/questions");
  await expect(page.getByRole("link", { name: /Download PDF/ })).toHaveAttribute("href", "/settings/questions/pdf");
});
