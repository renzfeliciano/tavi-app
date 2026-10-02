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
  await page.getByRole("checkbox", { name: /^I agree to the Terms of Service/ }).click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
}

export async function createBusiness(page: Page, name: string) {
  await page.getByLabel("Business name").fill(name);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/**
 * Test-only shortcut for "the user clicked the link in their verification
 * email": E2E runs have no mailbox. Writes straight to the test database.
 */
export async function markEmailVerified(email: string) {
  const { Client } = await import("pg");
  const { testDatabaseUrl } = await import("../src/db/testing/env");
  const client = new Client({ connectionString: testDatabaseUrl() });
  await client.connect();
  try {
    await client.query("update users set email_verified = true where email = $1", [email]);
  } finally {
    await client.end();
  }
}
