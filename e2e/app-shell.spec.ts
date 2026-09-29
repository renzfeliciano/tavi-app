import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const SCREENS = ["/dashboard", "/quotes", "/invoices", "/payments", "/customers", "/catalog", "/settings"];

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
    const current = nav.getByRole("link", { name: "Quotes" });
    await expect(current).toHaveAttribute("aria-current", "page");
    if (!isMobile) {
      await expect(nav.getByRole("link", { name: "Invoices" })).not.toHaveAttribute("aria-current");
    }
  });

  // Desktop opens a menu; phones open a bottom sheet (a dialog). Scope to
  // whichever is open, since the dashboard also links to "New quote".
  const openNewMenu = async (page: import("@playwright/test").Page) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "New", exact: true }).click();
    return page.getByRole("menu").or(page.getByRole("dialog"));
  };

  test("the New menu offers every quick action", async ({ page }) => {
    const menu = await openNewMenu(page);
    for (const label of ["New quote", "New invoice", "Add customer", "Record payment"]) {
      await expect(
        menu.getByRole("menuitem", { name: new RegExp(label) }).or(
          menu.getByRole("link", { name: new RegExp(label) }),
        ),
      ).toBeVisible();
    }
  });

  test("New quote navigates to the quote editor", async ({ page }) => {
    const menu = await openNewMenu(page);
    await menu
      .getByRole("menuitem", { name: /New quote/ })
      .or(menu.getByRole("link", { name: /New quote/ }))
      .click();

    await expect(page).toHaveURL(/\/quotes\/new$/);
    await expect(page.getByRole("heading", { level: 1, name: "New quote" })).toBeVisible();
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

test.describe("phone navigation", () => {
  test.skip(({ isMobile }) => !isMobile, "Phone-only tab bar");

  test("More reaches the sections not on the tab bar", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("link", { name: "Customers" }).click();
    await expect(page).toHaveURL(/\/customers$/);
    await expect(page.getByRole("heading", { level: 1, name: "Customers" })).toBeVisible();
  });
});
