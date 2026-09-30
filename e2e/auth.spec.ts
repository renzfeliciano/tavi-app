import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createBusiness, signUp, strongPassword, uniqueEmail } from "./helpers";

// These flows start signed out.
test.use({ storageState: { cookies: [], origins: [] } });

const axe = (page: import("@playwright/test").Page) =>
  new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();

test.describe("signed out", () => {
  test("app pages send you to sign in", async ({ page }) => {
    await page.goto("/quotes");
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("heading", { name: "Sign in to Tavi" })).toBeVisible();
  });

  for (const path of ["/sign-in", "/sign-up", "/forgot-password", "/reset-password"]) {
    test(`${path} has no WCAG 2.2 AA violations`, async ({ page }) => {
      await page.goto(path);
      expect((await axe(page)).violations).toEqual([]);
    });
  }
});

test("sign up, set up the business and land on the dashboard", async ({ page }) => {
  const email = uniqueEmail("signup");
  await signUp(page, { name: "Juan dela Cruz", email, password: strongPassword() });

  await expect(page.getByRole("heading", { name: "Welcome, Juan" })).toBeVisible();
  expect((await axe(page)).violations).toEqual([]);

  await createBusiness(page, "Dela Cruz Cleaning");
  await expect(page.getByText("Dela Cruz Cleaning").first()).toBeVisible();
  // Progressive verification: the app works, with a reminder to verify.
  await expect(page.getByRole("region", { name: "Email verification" })).toContainText(email);
});

test("onboarding explains a missing business name", async ({ page }) => {
  await signUp(page, { name: "Ana", email: uniqueEmail("onboard"), password: strongPassword() });
  await page.getByLabel("Business name").fill("   ");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Enter your business name.")).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("sign out, fail with a wrong password, then sign in", async ({ page }) => {
  const email = uniqueEmail("signin");
  const password = strongPassword();
  await signUp(page, { name: "Rosa Reyes", email, password });
  await createBusiness(page, "Reyes Repairs");

  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("definitely not the password");
  await page.getByRole("button", { name: "Sign in" }).click();
  // Scope by text: Next.js also renders a hidden role="alert" route announcer.
  await expect(
    page.getByRole("alert").filter({ hasText: "email and password don't match" }),
  ).toBeVisible();

  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Reyes Repairs").first()).toBeVisible();
});

test("password reset request gives the same answer for any email", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("nobody-here@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If there's a Tavi account for nobody-here@example.com");
});
