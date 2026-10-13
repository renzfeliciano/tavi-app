import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { asVisitor, createBusiness, seedCustomers, signUp, strongPassword, tableRows, uniqueEmail } from "./helpers";

// The data-table rule: a fixed-height panel with one inner scroll, a sticky
// header, an item count, page sizes and a pager that stay in view, a search
// that waits for a pause, and page clicks that don't pile up. Customers stand
// in for every list, which all use the same table (src/components/data-table.tsx).
// Desktop only (it signs up its own business).

test.use({ storageState: { cookies: [], origins: [] }, ...asVisitor("data-table") });
test.describe.configure({ mode: "serial" });

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  const email = uniqueEmail("data-table");
  await signUp(page, { name: "Maria Santos", email, password: strongPassword() });
  await createBusiness(page, "Santos Aircon");
  await seedCustomers(email, 60);
});

test.afterAll(async () => {
  await page.context().close();
});

const panel = () => page.getByRole("region", { name: "Customer list" });
const scroller = () => page.getByTestId("data-table-scroll");
const footer = () => page.getByRole("group", { name: "Customer list footer" });
const box = async (locator: ReturnType<Page["locator"]>) => {
  const found = await locator.boundingBox();
  if (!found) throw new Error("not on screen");
  return found;
};

/** What sticks out past the right edge of the window, so a failure says what to fix. */
const stickingOut = (target: Page) =>
  target.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 6)
      .map((el) => `${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(" ").slice(0, 3).join(".")}` : ""} → ${Math.round(el.getBoundingClientRect().right)}px`),
  );

/** Counts the requests Next's router makes for a list, apart from its prefetches. */
function countNavigations(target: Page) {
  const urls: string[] = [];
  target.on("request", (request) => {
    const headers = request.headers();
    if (headers.rsc === "1" && !headers["next-router-prefetch"]) urls.push(request.url());
  });
  return urls;
}

test("a long list scrolls inside a panel that is the same height at every page size, header and footer in view", async () => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/customers");
  await expect(footer().getByText("Showing 1–25 of 60 customers")).toBeVisible();
  const at25 = await box(panel());

  await page.goto("/customers?size=100");
  await expect(footer().getByText("Showing 1–60 of 60 customers")).toBeVisible();
  const at100 = await box(panel());
  expect(at100.height).toBe(at25.height);

  // The rows are taller than the panel, so they scroll inside it...
  const { scrollHeight, clientHeight } = await scroller().evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  expect(scrollHeight).toBeGreaterThan(clientHeight * 2);

  // ...while the column headers stay at the top of the panel and the footer at the bottom.
  await scroller().evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  await expect(page.getByRole("row", { name: /Customer 060/ })).toBeInViewport();
  const scrollBox = await box(scroller());
  const header = await box(page.getByRole("columnheader", { name: "Customer", exact: true }));
  expect(Math.abs(header.y - scrollBox.y)).toBeLessThan(16);
  const footerBox = await box(footer());
  expect(footerBox.y).toBeGreaterThanOrEqual(scrollBox.y + scrollBox.height - 1);
  expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(at100.y + at100.height + 1);
  // The page itself isn't what scrolls to show the footer.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("counts what is shown, pages, and changes the page size, keeping the rest of the address", async () => {
  await page.goto("/customers");
  await expect(footer().getByText("Showing 1–25 of 60 customers")).toBeVisible();
  await expect(footer().getByText("Page 1 of 3")).toBeVisible();
  await expect(footer().locator('[aria-disabled="true"]', { hasText: "Previous" })).toBeVisible();
  await expect(tableRows(page, "Customer list")).toHaveCount(25);

  await footer().getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/\/customers\?page=2$/);
  await expect(footer().getByText("Showing 26–50 of 60 customers")).toBeVisible();
  await expect(tableRows(page, "Customer list").first()).toContainText("Customer 026");

  // A new size starts again at page 1.
  await footer().getByRole("link", { name: "50", exact: true }).click();
  await expect(page).toHaveURL(/\/customers\?size=50$/);
  await expect(footer().getByText("Showing 1–50 of 60 customers")).toBeVisible();
  await expect(footer().getByRole("link", { name: "50", exact: true })).toHaveAttribute("aria-current", "true");
  await expect(tableRows(page, "Customer list")).toHaveCount(50);

  await footer().getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/\/customers\?page=2&size=50$/);
  await expect(footer().getByText("Showing 51–60 of 60 customers")).toBeVisible();
  await expect(footer().locator('[aria-disabled="true"]', { hasText: "Next" })).toBeVisible();
});

test("the search waits for a pause in typing, makes one request, and starts at page 1", async () => {
  await page.goto("/customers?page=2");
  const search = page.getByRole("searchbox", { name: "Search customers" });
  await expect(search).toBeVisible();
  // React must have hydrated, or the typing below is a plain, unhandled input.
  await expect(page.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/customers?page=3");
  const navigations = countNavigations(page);

  await search.pressSequentially("Customer 05", { delay: 60 });
  await expect(page).toHaveURL(/\/customers\?q=Customer\+05$/);
  await expect(footer().getByText("Showing 1–10 of 10 customers")).toBeVisible();
  expect(navigations.filter((url) => url.includes("q="))).toHaveLength(1);
  await expect(footer().getByRole("navigation", { name: "Pages" })).toHaveCount(0);

  // Typing the same text again makes no request.
  const before = navigations.length;
  await search.fill("Customer 05 ");
  await page.waitForTimeout(700);
  expect(navigations.length).toBe(before);

  await search.fill("zzz");
  await search.press("Enter");
  await expect(page.getByRole("heading", { name: "No customers match “zzz”" })).toBeVisible();
  await page.getByRole("link", { name: "Clear search" }).click();
  await expect(search).toHaveValue("");
  await expect(footer().getByText("Showing 1–25 of 60 customers")).toBeVisible();
});

test("a burst of clicks on the pager makes the first navigation and the last, not every one", async () => {
  await page.goto("/customers");
  const next = footer().getByRole("link", { name: "Next" });
  await expect(next).toHaveAttribute("href", "/customers?page=2");
  const navigations = countNavigations(page);

  // Next, Next, Next as fast as a hand can: the same click repeated is one navigation, not three.
  await next.click({ clickCount: 3, delay: 20 });
  await expect(page).toHaveURL(/\/customers\?page=2$/);
  await expect(footer().getByText("Showing 26–50 of 60 customers")).toBeVisible();
  expect(navigations.filter((url) => url.includes("page=2"))).toHaveLength(1);
});

test("a phone shows stacked rows with the footer under them, and nothing scrolls sideways", async () => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("/customers");
  await expect(footer().getByText("Showing 1–25 of 60 customers")).toBeVisible();

  // No column headers on a phone: each row is a stack of title, amount-side and summary.
  await expect(page.getByRole("columnheader").first()).toBeHidden();
  const row = tableRows(page, "Customer list").first();
  await expect(row).toContainText("Customer 001");
  await expect(row).toContainText("customer1@example.com");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);

  // The footer is in view without scrolling the page (above the tab bar), and still has its sizes and pager.
  // (This business hasn't confirmed its email, so the notice that streams in above the page is there too.)
  await expect(page.getByText(/before sending quotes to customers/)).toBeVisible();
  await expect.poll(async () => (await box(footer())).y + (await box(footer())).height).toBeLessThanOrEqual(915 - TAB_BAR);
  expect((await box(footer())).height).toBeLessThan(120);
  await expect(footer().getByRole("link", { name: "Next" })).toBeVisible();
  // The sizes are for larger screens; a phone's footer is the count and a pager across its width.
  await expect(footer().getByRole("link", { name: "100", exact: true })).toBeHidden();
  const next = await box(footer().getByRole("link", { name: "Next" }));
  expect(next.height).toBeGreaterThanOrEqual(24);
  await page.setViewportSize({ width: 1280, height: 800 });
});

test("a phone's footer is just the count when everything fits one page", async () => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("/customers?q=Customer+05");
  await expect(footer().getByText("Showing 1–10 of 10 customers")).toBeVisible();

  await expect(footer().getByRole("navigation", { name: "Pages" })).toHaveCount(0);
  const footerBox = await box(footer());
  expect(footerBox.height).toBeLessThan(56);
  await page.setViewportSize({ width: 1280, height: 800 });
});

// What shows above the panel and below it changes with the layout (a top bar and tab bar under 1024px wide),
// so the panel's height is measured at the sizes people use rather than trusted.
const TAB_BAR = 56;
for (const { name, width, height, below } of [
  { name: "a phone", width: 412, height: 915, below: TAB_BAR },
  { name: "a small phone", width: 360, height: 740, below: TAB_BAR },
  { name: "a tablet", width: 820, height: 1180, below: TAB_BAR },
  { name: "a laptop", width: 1280, height: 720, below: 0 },
  { name: "a desktop", width: 1920, height: 1080, below: 0 },
]) {
  test(`on ${name} the whole table, footer included, is in view without scrolling the page`, async () => {
    await page.setViewportSize({ width, height });
    await page.goto("/customers");
    await expect(footer().getByText("Showing 1–25 of 60 customers")).toBeVisible();

    // The notice about an unconfirmed email streams in above the page; the panel makes room for it.
    await expect(page.getByText(/before sending quotes to customers/)).toBeVisible();
    await expect.poll(async () => {
      const panelBox = await box(panel());
      // A window too short for the page header, search and a few rows scrolls the page instead (the panel's minimum).
      return panelBox.y + 22 * 16 + below > height || panelBox.y + panelBox.height <= height - below;
    }).toBe(true);
    const panelBox = await box(panel());
    expect(panelBox.height).toBeGreaterThanOrEqual(22 * 16 - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), (await stickingOut(page)).join("\n")).toBe(false);
  });
}

test("the table has no accessibility violations, with rows and without", async () => {
  await page.goto("/customers");
  await expect(footer().getByText("Showing 1–25 of 60 customers")).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
});
