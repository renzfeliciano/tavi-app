import { createHash, randomBytes } from "node:crypto";
import { expect, type Page } from "@playwright/test";

/** A unique address per test run; example.com never receives mail. */
export function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${randomBytes(3).toString("hex")}@example.com`;
}

/**
 * Options that make a spec's browsers look like one visitor of their own.
 * Production allows 10 sign-ups a minute per client IP, which Better Auth
 * reads from `x-forwarded-for` (Vercel sets it to the visitor's address). The
 * E2E server has no proxy in front of it, so without this every test account
 * would come from one shared address and the suite would trip the limit as
 * it grows. Use it in every spec that signs up (`ACCOUNT_CREATING_SPECS`).
 * Addresses are from TEST-NET-2 (RFC 5737), which is never routed.
 */
export function asVisitor(label: string): { extraHTTPHeaders: Record<string, string> } {
  let hash = 0;
  for (const char of label) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return { extraHTTPHeaders: { "x-forwarded-for": `198.51.100.${(hash % 254) + 1}` } };
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
  // The kind of business is required (D21). The radios are visually hidden, so click their label.
  await page.locator("label", { hasText: "Home services" }).click();
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

/** Test-only: pretend this account agreed to an older version of the Terms (D15). */
export async function setTermsVersion(email: string, version: string) {
  const { Client } = await import("pg");
  const { testDatabaseUrl } = await import("../src/db/testing/env");
  const client = new Client({ connectionString: testDatabaseUrl() });
  await client.connect();
  try {
    await client.query("update users set terms_version = $2 where email = $1", [email, version]);
  } finally {
    await client.end();
  }
}

/**
 * Test-only: a working link for the invitation the app just created for `to`.
 * The real link exists only in the email, and the outbox drops an email's body
 * once it is sent (dispatchOutbox), so E2E, which has no mailbox, issues a
 * fresh token for that same invitation instead.
 */
export async function freshInvitationPath(to: string): Promise<string> {
  const { Client } = await import("pg");
  const { testDatabaseUrl } = await import("../src/db/testing/env");
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const client = new Client({ connectionString: testDatabaseUrl() });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      `update invitations set token_hash = $1
       where id = (
         select id from invitations
         where email = $2 and accepted_at is null and revoked_at is null
         order by created_at desc limit 1
       )`,
      [tokenHash, to],
    );
    if (rowCount !== 1) throw new Error(`No open invitation for ${to}`);
    return `/invite/${token}`;
  } finally {
    await client.end();
  }
}

/** Test-only: whether the latest email queued for `to` is still "pending", or already "sent" (or "failed"). */
export async function latestEmailStatus(to: string): Promise<string | undefined> {
  const { Client } = await import("pg");
  const { testDatabaseUrl } = await import("../src/db/testing/env");
  const client = new Client({ connectionString: testDatabaseUrl() });
  await client.connect();
  try {
    const { rows } = await client.query<{ status: string }>(
      "select status from outbox_messages where payload->>'to' = $1 order by created_at desc limit 1",
      [to],
    );
    return rows[0]?.status;
  } finally {
    await client.end();
  }
}
