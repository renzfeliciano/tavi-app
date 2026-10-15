import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, test } from "@playwright/test";
import { SCREENS } from "./screens";

test.describe("app shell", () => {
  for (const path of SCREENS) {
    test(`${path} has no WCAG 2.2 AA violations and no sideways scroll`, async ({ page }) => {
      await page.goto(path);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations).toEqual([]);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);
    });
  }

  test("marks the current section in the navigation", async ({ page, isMobile }) => {
    await page.goto("/quotes");
    const nav = page.getByRole("navigation", { name: "Main" }).filter({ visible: true });
    const current = nav.getByRole("link", { name: "Quotations" });
    await expect(current).toHaveAttribute("aria-current", "page");
    if (!isMobile) {
      await expect(nav.getByRole("link", { name: "Billing statements" })).not.toHaveAttribute("aria-current");
    }
  });

  // Desktop opens a menu; phones open a bottom sheet (a dialog). Scope to
  // whichever is open, since the dashboard also links to "New quotation".
  const openNewMenu = async (page: import("@playwright/test").Page) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "New", exact: true }).click();
    return page.getByRole("menu").or(page.getByRole("dialog"));
  };

  test("the New menu offers every quick action", async ({ page }) => {
    const menu = await openNewMenu(page);
    for (const label of ["New quotation", "New billing statement", "New receipt", "New purchase order", "Add customer", "Product", "Service"]) {
      await expect(
        menu.getByRole("menuitem", { name: new RegExp(`^${label}`) }).or(
          menu.getByRole("link", { name: new RegExp(`^${label}`) }),
        ),
      ).toBeVisible();
    }
  });

  test("New quotation navigates to the quotation editor", async ({ page }) => {
    const menu = await openNewMenu(page);
    await menu
      .getByRole("menuitem", { name: /New quotation/ })
      .or(menu.getByRole("link", { name: /New quotation/ }))
      .click();

    await expect(page).toHaveURL(/\/quotes\/new$/);
    await expect(page.getByRole("heading", { level: 1, name: "New quotation" })).toBeVisible();
  });

  test("keyboard users can skip straight to the content", async ({ page, isMobile }) => {
    test.skip(isMobile, "Skip links are a keyboard affordance");
    await page.goto("/dashboard");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
  });
});

/** A box measured once it has stopped moving: the sidebar collapses and popups open with a short animation. */
async function settledBox(locator: Locator) {
  let last = "";
  let box: Awaited<ReturnType<Locator["boundingBox"]>> = null;
  await expect
    .poll(async () => {
      box = await locator.boundingBox();
      const now = JSON.stringify(box);
      const settled = box !== null && now === last;
      last = now;
      return settled;
    })
    .toBe(true);
  return box!;
}

// The sidebar on a laptop: a window about 730px tall is common, and a long account name is too.
test.describe("desktop sidebar", () => {
  test.skip(({ isMobile }) => isMobile, "The phone has a drawer and a tab bar instead");
  test.use({ viewport: { width: 1536, height: 730 } });

  test("a long account name stays inside the sidebar, and the Ctrl B hint with it", async ({ page }) => {
    await page.goto("/dashboard");
    // Wait for React to take the page over: it gives the account button its props only then, and
    // a name changed before that would be thrown away when React re-draws the sidebar.
    await page.waitForFunction(() => {
      const account = [...document.querySelectorAll("#app-sidebar button")].at(-1);
      return !!account && Object.keys(account).some((key) => key.startsWith("__reactProps"));
    });
    // The account row is the last button in the sidebar; give it a name too long to fit, and
    // measure in the same step so nothing can re-draw in between.
    const edges = await page.evaluate(() => {
      const sidebar = document.querySelector("#app-sidebar")!;
      const account = [...sidebar.querySelectorAll("button")].at(-1)!;
      const name = account.querySelector("span.truncate");
      if (name) name.textContent = "Travis Renz's Repair Shop and Aircon Services of Metro Manila";
      const right = (el: Element) => el.getBoundingClientRect().right;
      return { sidebar: right(sidebar), hint: right(sidebar.querySelector("kbd")!), account: right(account) };
    });

    expect(edges.hint).toBeLessThanOrEqual(edges.sidebar);
    expect(edges.account).toBeLessThanOrEqual(edges.sidebar);
  });

  test("the links and Today fit a 730px-tall window without scrolling", async ({ page }) => {
    await page.goto("/dashboard");
    const links = page.locator("#app-sidebar div.overflow-y-auto");
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();

    await expect.poll(() => links.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
  });

  test("the collapsed account menu opens beside the avatar, not at the top of the screen", async ({ page }) => {
    await page.goto("/dashboard");
    const shell = page.locator("#app-shell");
    // A click before the page has hydrated does nothing, so click again until the sidebar has collapsed.
    await expect(async () => {
      if ((await shell.getAttribute("data-sidebar")) !== "collapsed") {
        await page.getByRole("button", { name: /^Collapse/ }).click();
      }
      await expect(shell).toHaveAttribute("data-sidebar", "collapsed", { timeout: 1_000 });
    }).toPass({ timeout: 20_000 });

    const avatar = page.getByRole("button", { name: /account menu/ });
    const trigger = await settledBox(avatar);
    await avatar.click();
    const popup = page.locator('[data-slot="popover-content"]');
    await expect(popup).toBeVisible();
    const menu = await settledBox(popup);

    expect(menu.x).toBeGreaterThanOrEqual(trigger.x + trigger.width);
    expect(Math.abs(menu.y + menu.height - (trigger.y + trigger.height))).toBeLessThan(24);
  });
});

test.describe("phone navigation", () => {
  test.skip(({ isMobile }) => !isMobile, "Phone-only tab bar");

  test("Menu reaches the sections not on the tab bar", async ({ page }) => {
    await page.goto("/dashboard");
    // The top bar has "Open menu" too, so match the tab bar's button exactly. A tap before the
    // page has hydrated does nothing, so tap again until the drawer is open.
    const drawer = page.getByRole("dialog");
    await expect(async () => {
      if (!(await drawer.isVisible())) await page.getByRole("button", { name: "Menu", exact: true }).click();
      await expect(drawer).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await drawer.getByRole("link", { name: "Customers" }).click();
    await expect(page).toHaveURL(/\/customers$/);
    await expect(page.getByRole("heading", { level: 1, name: "Customers" })).toBeVisible();
  });
});
