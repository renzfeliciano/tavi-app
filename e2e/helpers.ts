import { randomBytes } from "node:crypto";
import { expect, type Page } from "@playwright/test";

/** A unique address per test run; example.com never receives mail. */
export function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${randomBytes(3).toString("hex")}@example.com`;
}

/** Long and random, so the breached-password check never rejects it. */
export function strongPassword(): string {
  return `tavi e2e ${randomBytes(12).toString("base64url")}`;
}

export async function signUp(page: Page, { name, email, password }: { name: string; email: string; password: string }) {
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
}

export async function createBusiness(page: Page, name: string) {
  await page.getByLabel("Business name").fill(name);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
