import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { asVisitor, createBusiness, markEmailVerified, signUp, strongPassword, uniqueEmail } from "./helpers";

// The panel beside an issued quotation or billing statement: who it is for, its dates, what has happened to it.
// One fresh business with a customer and real documents (written and sent through the screens). Desktop only
// (see ACCOUNT_CREATING_SPECS in playwright.config.ts); the phone layout is checked by resizing the window.
test.use({ storageState: { cookies: [], origins: [] }, ...asVisitor("document-panel") });
test.describe.configure({ mode: "serial" });
test.slow();

let page: Page;
let juanId: string;
let invoiceId: string;
let quoteId: string;

const axe = (p: Page) =>
  new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
const toast = (text: string | RegExp) => page.locator("[data-sonner-toast]").filter({ hasText: text });
const invoicePanel = () => page.getByRole("complementary", { name: "Billing statement details" });
const quotePanel = () => page.getByRole("complementary", { name: "Quotation details" });
const invoicePaper = () => page.getByRole("article", { name: "Billing statement INV-000001" });
const quotePaper = () => page.getByRole("article", { name: "Quotation QUO-000001" });

/**
 * A calendar date this many days ago in the test business's own time zone (Manila, which has no daylight saving),
 * so a statement is a known number of days past due whatever hour this runs: the panel counts days there, not in UTC.
 */
const daysAgo = (days: number, now = Date.now()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(now - days * 86_400_000);

async function box(locator: ReturnType<Page["locator"]>) {
  const found = await locator.boundingBox();
  if (!found) throw new Error("not on screen");
  return found;
}

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  const email = uniqueEmail("document-panel");
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
});

test.afterAll(async () => {
  await page.context().close();
});

test("a sent billing statement shows its customer, its dates and what has happened to it", async () => {
  await page.goto(`/invoices/new?customer=${juanId}`);
  // The first line appearing shows the editor is ready for input; dates typed before that are lost.
  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByLabel("Line 1 description").fill("Aircon cleaning");
  // Issued three weeks ago and due ten days ago: past due, whatever day this runs.
  await page.getByLabel("Date", { exact: true }).fill(daysAgo(24));
  await page.getByLabel("Due date").fill(daysAgo(10));
  await page.getByLabel("Price (PHP)").first().fill("1,500");
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}$/);
  invoiceId = page.url().match(/\/invoices\/([0-9a-f-]{36})$/)?.[1] ?? "";

  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("dialog", { name: /^Send / }).getByRole("button", { name: "Send email" }).click();
  await expect(toast("Billing statement INV-000001 sent to juan@example.com.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Billing statement INV-000001" })).toBeVisible();

  const panel = invoicePanel();
  await expect(panel.getByRole("link", { name: "Juan Dela Cruz" })).toHaveAttribute("href", `/customers/${juanId}`);
  await expect(panel).toContainText("juan@example.com");
  await expect(panel.getByText("Due date").locator("..")).toContainText("10 days overdue");
  await expect(panel.getByRole("listitem").filter({ hasText: "Sent" })).toBeVisible();
  // Nothing was made from a quotation, so nothing is related.
  await expect(panel.getByRole("heading", { name: "Related" })).toHaveCount(0);
  expect((await axe(page)).violations).toEqual([]);
});

test("the customer's name opens their record", async () => {
  await invoicePanel().getByRole("link", { name: "Juan Dela Cruz" }).click();
  await expect(page).toHaveURL(new RegExp(`/customers/${juanId}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Juan Dela Cruz" })).toBeVisible();
});

test("on a desktop the panel stands to the right of the paper, level with what is above it", async () => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/invoices/${invoiceId}`);
  const panel = await box(invoicePanel());
  const paper = await box(invoicePaper());
  const payments = await box(page.getByRole("region", { name: "Payments" }));

  expect(panel.x).toBeGreaterThanOrEqual(paper.x + paper.width);
  expect(Math.abs(panel.width - 288)).toBeLessThanOrEqual(1);
  expect(Math.abs(panel.y - payments.y)).toBeLessThanOrEqual(2);
  expect(paper.y).toBeGreaterThan(payments.y + payments.height);
  await expect(invoicePanel()).toHaveCSS("position", "sticky");
});

test("on a phone it comes before the paper, and nothing runs off the side", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/invoices/${invoiceId}`);
  const panel = await box(invoicePanel());
  const paper = await box(invoicePaper());

  expect(panel.y + panel.height).toBeLessThanOrEqual(paper.y);
  expect(Math.abs(panel.x - paper.x)).toBeLessThanOrEqual(1);
  await expect(invoicePanel()).toHaveCSS("position", "static");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  expect((await axe(page)).violations).toEqual([]);
});

test("a sent quotation has the same panel, with how long it stays open", async () => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/quotes/new?customer=${juanId}`);
  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByLabel("Line 1 description").fill("Aircon repair");
  await page.getByLabel("Price (PHP)").first().fill("2,500");
  await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}$/);
  quoteId = page.url().match(/\/quotes\/([0-9a-f-]{36})$/)?.[1] ?? "";

  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("dialog", { name: /^Send / }).getByRole("button", { name: "Send email" }).click();
  await expect(toast(/QUO-000001 sent to juan@example\.com/)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Quotation QUO-000001" })).toBeVisible();

  const panel = quotePanel();
  await expect(panel.getByRole("link", { name: "Juan Dela Cruz" })).toHaveAttribute("href", `/customers/${juanId}`);
  await expect(panel.getByText("Valid until").locator("..")).toContainText(/\d+ days left/);
  await expect(panel.getByRole("listitem").filter({ hasText: "Sent" })).toBeVisible();

  const panelBox = await box(panel);
  const paperBox = await box(quotePaper());
  expect(panelBox.x).toBeGreaterThanOrEqual(paperBox.x + paperBox.width);
  expect(Math.abs(panelBox.y - paperBox.y)).toBeLessThanOrEqual(2);
  expect((await axe(page)).violations).toEqual([]);
});

/**
 * Opens a document from its list while the page's own answer is held back, and measures the loading screen's
 * panel and paper against the real ones that replace it.
 */
async function loadingScreenHolds(opts: { list: string; link: RegExp; path: string; loading: string; panel: () => ReturnType<Page["locator"]>; paper: () => ReturnType<Page["locator"]> }) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(opts.list);
  const link = page.getByRole("link", { name: opts.link }).first();
  await expect(link).toBeVisible();
  // Resting on the link lets the router fetch the page's loading screen, as it does for a person about to click.
  await link.hover();
  await page.waitForLoadState("networkidle");
  let slow = true;
  await page.route(opts.path, async (route) => {
    // Hold back the page's own answer, not the router's prefetch of the loading screen that comes first.
    const { rsc, "next-router-prefetch": prefetch } = route.request().headers();
    if (slow && rsc === "1" && !prefetch) await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });

  await link.click();
  const skeleton = page.getByRole("status").filter({ hasText: opts.loading });
  await expect(skeleton).toBeVisible();
  const waitingPanel = await box(skeleton.locator('[class*="xl:col-start-2"]'));
  const waitingPaper = await box(skeleton.locator(".shadow-sm").first());
  await expect(skeleton).toBeHidden();
  slow = false;
  await expect(opts.panel()).toBeVisible();
  const panel = await box(opts.panel());
  const paper = await box(opts.paper());
  for (const [waiting, arrived] of [
    [waitingPanel, panel],
    [waitingPaper, paper],
  ] as const) {
    expect(Math.abs(waiting.y - arrived.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(waiting.x - arrived.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(waiting.width - arrived.width)).toBeLessThanOrEqual(1);
  }
  await page.unroute(opts.path);
}

test("while a statement loads, its skeleton holds the panel and the paper where they will be", async () => {
  await loadingScreenHolds({
    list: "/invoices",
    link: /INV-000001/,
    path: `**/invoices/${invoiceId}**`,
    loading: "Loading billing statement",
    panel: invoicePanel,
    paper: invoicePaper,
  });
});

test("while a quotation loads, its skeleton holds the panel and the paper where they will be", async () => {
  await loadingScreenHolds({
    list: "/quotes",
    link: /QUO-000001/,
    path: `**/quotes/${quoteId}**`,
    loading: "Loading quotation",
    panel: quotePanel,
    paper: quotePaper,
  });
});
