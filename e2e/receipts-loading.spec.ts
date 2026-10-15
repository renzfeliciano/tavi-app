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
  tableRows,
  uniqueEmail,
} from "./helpers";

// While a receipts page loads, its skeleton holds the same blocks where the real ones will be: the list, the new
// receipt form and a receipt. Made-up names and numbers only. Desktop only (see ACCOUNT_CREATING_SPECS).
test.use({
  storageState: { cookies: [], origins: [] },
  ...asVisitor("receipts-loading"),
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
  const email = uniqueEmail("receipts-loading");
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
  // A receipt, so the list is a list (not its empty state) when the skeleton is compared with it.
  await page.goto("/receipts/new");
  await page.getByRole("radio", { name: "Someone else" }).check();
  await page.getByLabel("Payer's name").fill("Pedro Reyes");
  await page.getByLabel("Amount received (PHP)").fill("1,500");
  await page.getByLabel("Received for").fill("Reimbursement of fuel");
  await page.getByRole("button", { name: "Make receipt" }).click();
  await expect(toast("Receipt REC-000001 made.")).toBeVisible();
  await expect(page).toHaveURL(/\/receipts\/[0-9a-f-]{36}$/);
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

test("while the receipts list loads, its skeleton holds the header and the list where they will be", async () => {
  await loadingScreenHolds({
    from: "/payments",
    link: () => page.getByRole("link", { name: "Receipts", exact: true }),
    path: /\/receipts(\?|$)/,
    loading: "Loading receipts",
    ready: () => page.getByRole("heading", { level: 1, name: "Receipts" }),
  });
});

test("while the new receipt form loads, its skeleton holds the header and the form where they will be", async () => {
  await loadingScreenHolds({
    from: "/receipts",
    link: () => page.locator("#main").getByRole("link", { name: "New receipt" }),
    path: /\/receipts\/new(\?|$)/,
    loading: "Loading the form",
    ready: () => page.getByRole("heading", { level: 1, name: "New receipt" }),
  });
});

test("while a receipt loads, its skeleton holds the header and the paper where they will be", async () => {
  await loadingScreenHolds({
    from: "/receipts",
    link: () => tableRows(page, "Receipt list").first().getByRole("link").first(),
    path: /\/receipts\/[0-9a-f-]{36}(\?|$)/,
    loading: "Loading receipt",
    ready: () => page.getByRole("heading", { level: 1, name: "Collection receipt REC-000001" }),
  });
});
