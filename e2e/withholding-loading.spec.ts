import {
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import {
  asVisitor,
  createBusiness,
  markEmailVerified,
  signUp,
  strongPassword,
  uniqueEmail,
} from "./helpers";

// While a 2307 page loads, its skeleton holds the same blocks where the real ones will be: the withholding list, the
// record form and a certificate. Made-up names and numbers only. Desktop only (see ACCOUNT_CREATING_SPECS).
test.use({
  storageState: { cookies: [], origins: [] },
  ...asVisitor("withholding-loading"),
});
test.describe.configure({ mode: "serial" });
test.slow();

let context: BrowserContext;
let page: Page;

const toast = (text: string | RegExp) =>
  page.locator("[data-sonner-toast]").filter({ hasText: text });

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  const email = uniqueEmail("withholding-loading");
  await signUp(page, {
    name: "Maria Santos",
    email,
    password: strongPassword(),
  });
  await createBusiness(page, "Santos Aircon");
  await markEmailVerified(email);
  await page.goto("/customers/new");
  await page.getByLabel("Name", { exact: true }).fill("Juan Dela Cruz");
  await page.getByRole("textbox", { name: /^Email/ }).fill("juan@example.com");
  await page.getByRole("button", { name: "Add customer" }).click();
  await expect(toast("Juan Dela Cruz added.")).toBeVisible();

  await page.goto("/invoices/new");
  await page
    .getByRole("combobox", { name: "Customer", exact: true })
    .fill("Juan");
  await page.getByRole("option", { name: /Juan Dela Cruz/ }).click();
  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByLabel("Line 1 description").fill("Aircon cleaning");
  await page.getByLabel("Price (PHP)").first().fill("2,000");
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const send = page.getByRole("dialog", { name: /^Send / });
  await send.getByLabel("Copy link").check();
  await send
    .getByRole("button", { name: "Mark as sent and copy link" })
    .click();
  await expect(toast(/is ready\. Link copied\./)).toBeVisible();
  await page.getByRole("button", { name: "Record payment" }).click();
  const dialog = page.getByRole("dialog", { name: "Record a payment" });
  await dialog.getByLabel("Amount received (PHP)").fill("1,960");
  await dialog.getByLabel("Tax withheld (BIR Form 2307)").fill("40");
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(toast(/Payment recorded on/)).toBeVisible();
});

test.afterAll(async () => {
  await context.close();
});

/** The blocks of a page, top to bottom: the way back, the header, then each section or card. */
const blocks = async (root: Locator) => {
  // The page body sits inside wrappers that hold only it; step in until the blocks themselves.
  let parent = root;
  while ((await parent.locator(":scope > *").count()) === 1)
    parent = parent.locator(":scope > *");
  const found = await parent.locator(":scope > *").all();
  const boxes = [];
  for (const block of found) {
    const box = await block.boundingBox();
    if (box && box.height > 0) boxes.push(box);
  }
  return boxes;
};

/**
 * Follows a link while the destination's own answer is held back, and compares the loading screen's blocks with the
 * real page's: same left edge and width, same top, and the way back and the header the same height.
 */
async function loadingScreenHolds(opts: {
  from: string;
  link: () => Locator;
  path: RegExp;
  loading: string;
  ready: () => Locator;
}) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(opts.from);
  const link = opts.link();
  await expect(link).toBeVisible();
  // Resting on the link lets the router fetch the page's loading screen, as it does for a person about to click.
  await link.hover();
  await page.waitForLoadState("networkidle");
  let slow = true;
  await page.route(opts.path, async (route) => {
    // Hold back the page's own answer, not the router's prefetch of the loading screen that comes first.
    const { rsc, "next-router-prefetch": prefetch } = route.request().headers();
    if (slow && rsc === "1" && !prefetch)
      await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });

  await link.click();
  const skeleton = page.getByRole("status").filter({ hasText: opts.loading });
  await expect(skeleton).toBeVisible();
  const waiting = await blocks(skeleton.locator(":scope > div[aria-hidden]"));
  await expect(skeleton).toBeHidden();
  slow = false;
  await expect(opts.ready()).toBeVisible();
  const arrived = await blocks(page.locator("#main"));
  await page.unroute(opts.path);

  const round = (list: typeof waiting) =>
    list
      .map((b) => [b.x, b.y, b.width, b.height].map(Math.round).join(","))
      .join(" | ");
  expect(waiting.length).toBeGreaterThanOrEqual(2);
  // The way back and the header, then where the content starts.
  for (let i = 0; i < Math.min(3, waiting.length, arrived.length); i++) {
    const a = waiting[i]!;
    const b = arrived[i]!;
    expect(
      Math.abs(a.y - b.y),
      `block ${i} top; skeleton ${round(waiting)} vs page ${round(arrived)}`,
    ).toBeLessThanOrEqual(2);
    expect(Math.abs(a.x - b.x), `block ${i} left`).toBeLessThanOrEqual(1);
    // The way back shrinks to its words on the page; its placeholder is a full-width row of the same height.
    if (i > 0)
      expect(
        Math.abs(a.width - b.width),
        `block ${i} width`,
      ).toBeLessThanOrEqual(1);
    if (i < 2)
      expect(
        Math.abs(a.height - b.height),
        `block ${i} height`,
      ).toBeLessThanOrEqual(2);
  }
}

test("while the withholding list loads, its skeleton holds the header and the list where they will be", async () => {
  await loadingScreenHolds({
    from: "/payments",
    link: () => page.getByRole("link", { name: "Withholding (2307)" }),
    path: /\/payments\/withholding(\?|$)/,
    loading: "Loading withholding",
    ready: () =>
      page.getByRole("heading", { level: 1, name: "Withholding (2307)" }),
  });
});

test("while the record form loads, its skeleton holds the header and the form where they will be", async () => {
  await loadingScreenHolds({
    from: "/payments/withholding",
    link: () =>
      page
        .locator("#main")
        .getByRole("link", { name: /Juan Dela Cruz/ })
        .first(),
    path: /\/payments\/withholding\/new/,
    loading: "Loading",
    ready: () => page.getByRole("heading", { level: 1, name: "Record a 2307" }),
  });
});

test("while a certificate loads, its skeleton holds the header and the cards where they will be", async () => {
  await page.goto("/payments/withholding");
  await page
    .locator("#main")
    .getByRole("link", { name: /Juan Dela Cruz/ })
    .first()
    .click();
  await page.getByLabel(/^Payor's TIN/).fill("123-456-789-00000");
  await page.getByLabel(/^ATC$/).selectOption("WI160");
  await page.locator("#line-0-month1").fill("2,000");
  await page.getByRole("button", { name: "Save 2307" }).click();
  await expect(toast("2307 recorded.")).toBeVisible();
  await expect(page).toHaveURL(/\/payments\/withholding\/[0-9a-f-]{36}$/);

  await loadingScreenHolds({
    from: "/payments/withholding?view=received",
    link: () =>
      page
        .locator("#main")
        .getByRole("link", { name: /Juan Dela Cruz/ })
        .first(),
    path: /\/payments\/withholding\/[0-9a-f-]{36}/,
    loading: "Loading the certificate",
    ready: () =>
      page.getByRole("heading", { level: 1, name: "2307 from Juan Dela Cruz" }),
  });
});
