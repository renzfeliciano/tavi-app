import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { asVisitor, createBusiness, markEmailVerified, runDailyJob, signUp, strongPassword, uniqueEmail } from "./helpers";

// The owner repeats a sent billing statement: a draft is made on each due date for them to review, they can
// pause, edit and end the schedule, and ending asks first. Made-up names only. Desktop only (see ACCOUNT_CREATING_SPECS).
test.use({ storageState: { cookies: [], origins: [] }, ...asVisitor("recurring") });
test.describe.configure({ mode: "serial" });
test.slow();

let context: BrowserContext;
let page: Page;
let scheduleUrl: string;

const toast = (text: string | RegExp) => page.locator("[data-sonner-toast]").filter({ hasText: text });
const axe = (p: Page) =>
  new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("[data-sonner-toaster]").analyze();

async function send(kind: "quote" | "invoice") {
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /^Send / });
  await dialog.getByLabel("Copy link").check();
  await dialog.getByRole("button", { name: "Mark as sent and copy link" }).click();
  await expect(toast(/is ready\. Link copied\./)).toBeVisible();
  void kind;
}

async function bill(path: "/quotes/new" | "/invoices/new", price: string) {
  await page.goto(path);
  await page.getByRole("combobox", { name: "Customer", exact: true }).fill("Juan");
  await page.getByRole("option", { name: /Juan Dela Cruz/ }).click();
  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByLabel("Line 1 description").fill("Aircon cleaning");
  await page.getByLabel("Price (PHP)").first().fill(price);
  await expect(page).toHaveURL(/\/(quotes|invoices)\/[0-9a-f-]{36}$/);
}

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  page = await context.newPage();
  const email = uniqueEmail("recurring");
  await signUp(page, { name: "Maria Santos", email, password: strongPassword() });
  await createBusiness(page, "Santos Aircon");
  await markEmailVerified(email);
  await page.goto("/customers/new");
  await page.getByLabel("Name", { exact: true }).fill("Juan Dela Cruz");
  await page.getByRole("textbox", { name: /^Email/ }).fill("juan@example.com");
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(toast("Juan Dela Cruz added.")).toBeVisible();
  // The dashboard shows what needs attention once a quotation has been sent.
  await bill("/quotes/new", "900");
  await send("quote");
  await bill("/invoices/new", "1,500");
  await send("invoice");
});

test.afterAll(async () => {
  await context.close();
});

test("a draft can't be repeated, a sent billing statement can", async () => {
  await expect(page.locator("#main").getByRole("button", { name: "Repeat this" })).toBeVisible();
  await bill("/invoices/new", "100");
  await expect(page.locator("#main").getByRole("button", { name: "Repeat this" })).toHaveCount(0);
  await page.getByRole("button", { name: "Delete draft" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/invoices$/);
});

test("the owner repeats a sent billing statement every month from today", async () => {
  await page.goto("/invoices");
  await page.locator("#main").getByRole("link", { name: /INV-000001/ }).first().click();
  await page.locator("#main").getByRole("button", { name: "Repeat this" }).click();
  const dialog = page.getByRole("dialog", { name: "Repeat this statement" });
  await expect(dialog).toContainText("Nothing is sent by itself");
  await expect(dialog.getByLabel("How often")).toHaveValue("monthly");
  expect((await axe(page)).violations).toEqual([]);

  // A start date in the past is refused next to its field.
  await dialog.getByLabel("Starts on").fill("2020-01-01");
  await dialog.getByRole("button", { name: "Start repeating" }).click();
  await expect(dialog.getByText("Choose a start date from today on.")).toBeVisible();
  await expect(dialog.getByLabel("Starts on")).toHaveValue("2020-01-01");

  await page.goto(page.url());
  await page.locator("#main").getByRole("button", { name: "Repeat this" }).click();
  await page.getByRole("dialog", { name: "Repeat this statement" }).getByRole("button", { name: "Start repeating" }).click();
  await toast(/^Repeating every month from /).getByRole("button", { name: "View schedule" }).click();
  await expect(page).toHaveURL(/\/recurring\/[0-9a-f-]{36}$/);
  scheduleUrl = page.url();
  await expect(page.getByRole("heading", { level: 1, name: "Juan Dela Cruz" })).toBeVisible();
  await expect(page.locator("#main")).toContainText("Every month on the");
  await expect(page.locator("#main")).toContainText("Aircon cleaning");
  await expect(page.locator("#main")).toContainText("None yet");
  expect((await axe(page)).violations).toEqual([]);

  await page.goto("/recurring");
  await expect(page.getByRole("heading", { level: 1, name: "Recurring" })).toBeVisible();
  const row = page.getByRole("table", { name: "Recurring list" }).getByRole("row").filter({ hasText: "Juan Dela Cruz" });
  await expect(row).toContainText("Every month on the");
  await expect(row).toContainText("₱1,500.00");
  await expect(row).toContainText("Repeating");
  expect((await axe(page)).violations).toEqual([]);
});

test("the daily job makes a draft once, the dashboard asks for a look, and sending it takes the next number", async () => {
  // The job covers every business on the test server, so only this business's own figures are exact (below).
  const first = await runDailyJob(page);
  expect(first.recurringDrafts).toBeGreaterThanOrEqual(1);
  expect(first).toMatchObject({ recurringPaused: 0, failed: 0 });
  // Run twice by mistake: nothing more is made.
  expect(await runDailyJob(page)).toMatchObject({ recurringDrafts: 0, failed: 0 });

  await page.goto("/dashboard");
  await page.getByRole("link", { name: /1 recurring billing statement to review/ }).click();
  await expect(page).toHaveURL(/\/invoices\?status=draft$/);
  await page.locator("#main").getByRole("link", { name: /Juan Dela Cruz/ }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Draft billing statement" })).toBeVisible();
  await expect(page.getByLabel("Line 1 description")).toHaveValue("Aircon cleaning");
  const source = page.locator("#main").getByRole("link", { name: "From a recurring schedule" });
  await expect(source).toHaveAttribute("href", scheduleUrl.replace(/^https?:\/\/[^/]+/, ""));

  await send("invoice");
  await expect(page.getByRole("heading", { level: 1, name: /INV-000002/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "From a recurring schedule" })).toBeVisible();

  await page.goto(scheduleUrl);
  await expect(page.locator("#main")).toContainText("Made so far");
  await expect(page.locator("#main").getByRole("link", { name: /INV-000002/ })).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /recurring billing statement/ })).toHaveCount(0);
});

test("pausing stops it, resuming starts it again", async () => {
  await page.goto(scheduleUrl);
  await page.locator("#main").getByRole("button", { name: "Pause", exact: true }).click();
  await expect(toast("Schedule paused.")).toBeVisible();
  await expect(page.locator("#main").getByText("Paused", { exact: true })).toBeVisible();
  await expect(page.locator("#main").getByRole("button", { name: "Resume" })).toBeVisible();
  await page.locator("#main").getByRole("button", { name: "Resume" }).click();
  await expect(toast("Schedule resumed.")).toBeVisible();
  await expect(page.locator("#main").getByRole("button", { name: "Pause", exact: true })).toBeVisible();
});

test("editing changes the terms of the statements still to come", async () => {
  await page.goto(scheduleUrl);
  await page.locator("#main").getByRole("link", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Edit schedule" })).toBeVisible();
  await expect(page.locator("#main")).toContainText("Applies to the next statement onward.");
  await expect(page.getByLabel("Days to pay")).toHaveAttribute("placeholder", /^e\.g\. /);
  expect((await axe(page)).violations).toEqual([]);
  await page.getByLabel("Days to pay").fill("30");
  await page.getByLabel(/^Notes/).fill("Thank you for your business.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(toast("Schedule updated. It applies to the next statement onward.")).toBeVisible();
  await expect(page).toHaveURL(scheduleUrl);
  await expect(page.locator("#main")).toContainText("30 days after it is made");
  await expect(page.locator("#main")).toContainText("Thank you for your business.");
});

test("ending a schedule asks first, and the list then shows it as ended", async () => {
  await page.goto(scheduleUrl);
  await page.locator("#main").getByRole("button", { name: "End", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "End this schedule?" });
  await expect(dialog).toContainText("No more statements will be prepared. The ones already made stay.");
  expect((await axe(page)).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Keep it" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#main").getByRole("button", { name: "Pause", exact: true })).toBeVisible();

  await page.locator("#main").getByRole("button", { name: "End", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "End schedule" }).click();
  await expect(toast("Schedule ended.")).toBeVisible();
  await expect(page.locator("#main").getByRole("button", { name: "Pause", exact: true })).toHaveCount(0);
  await expect(page.locator("#main").getByRole("link", { name: /INV-000002/ })).toBeVisible();

  await page.goto("/recurring");
  const row = page.getByRole("table", { name: "Recurring list" }).getByRole("row").filter({ hasText: "Juan Dela Cruz" });
  await expect(row).toContainText("Ended");
  await page.getByRole("link", { name: "Ended", exact: true }).click();
  await expect(page).toHaveURL(/status=ended/);
  await expect(page.getByRole("table", { name: "Recurring list" }).getByRole("row").filter({ hasText: "Juan Dela Cruz" })).toBeVisible();
  // The job makes nothing for an ended schedule.
  expect(await runDailyJob(page)).toMatchObject({ recurringDrafts: 0, failed: 0 });
});

test("an ended schedule's edit page sends the person back to it", async () => {
  await page.goto(`${scheduleUrl}/edit`);
  await expect(page).toHaveURL(scheduleUrl);
});
