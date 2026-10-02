import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { strongPassword, uniqueEmail } from "./helpers";

// The Terms of Service and Privacy Notice (1.13b). Signed out, and no test
// here creates an account, so it runs on desktop and phone.
test.use({ storageState: { cookies: [], origins: [] } });

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();

for (const [path, heading] of [
  ["/terms", "Terms of Service"],
  ["/privacy", "Privacy Notice"],
] as const) {
  test(`${path} reads well, with no WCAG 2.2 AA violations or sideways scroll`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText(/^Version of /)).toBeVisible();
    expect((await axe(page)).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
}

test("sign-up links both documents and won't continue until they're agreed to", async ({ page }) => {
  await page.goto("/sign-up");
  const form = page.getByRole("main");
  await expect(form.getByRole("link", { name: /^Terms of Service/ })).toHaveAttribute("href", "/terms");
  await expect(form.getByRole("link", { name: /^Privacy Notice/ })).toHaveAttribute("href", "/privacy");
  await expect(page.getByRole("navigation", { name: "Legal" }).getByRole("link", { name: "Privacy" })).toBeVisible();

  await page.getByLabel("Your name").fill("Maria Santos");
  await page.getByLabel("Work email").fill(uniqueEmail("terms"));
  await page.getByLabel("Password", { exact: true }).fill(strongPassword());
  await page.getByRole("button", { name: "Create account" }).click();

  // Scope by text: Next.js also renders a hidden role="alert" route announcer.
  await expect(
    page.getByRole("alert").filter({ hasText: "Agree to the Terms of Service and Privacy Notice" }),
  ).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /^I agree to the Terms of Service/ })).toBeFocused();
  await expect(page).toHaveURL(/\/sign-up$/);
  expect((await axe(page)).violations).toEqual([]);
});
