import { createHash, randomBytes } from "node:crypto";
import { expect, type Page } from "@playwright/test";

/** The data rows of a list's table (not its header), in the order they are shown. */
export const tableRows = (page: Page, name: string) =>
  page.getByRole("table", { name }).getByRole("row").filter({ has: page.getByRole("link") });

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

/**
 * Test-only: `count` customers ("Customer 001" … ) in the business `ownerEmail` owns, for lists that need
 * more rows than fit on a page. Every third has a company and every second lives in Cebu (the rest Davao).
 */
export async function seedCustomers(ownerEmail: string, count: number) {
  const { Client } = await import("pg");
  const { testDatabaseUrl } = await import("../src/db/testing/env");
  const client = new Client({ connectionString: testDatabaseUrl() });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      `insert into customers (id, organization_id, display_name, company, email, city)
       select gen_random_uuid(), m.organization_id, 'Customer ' || lpad(n::text, 3, '0'),
              case when n % 3 = 0 then 'Company ' || n end,
              'customer' || n || '@example.com',
              case when n % 2 = 0 then 'Cebu' else 'Davao' end
       from memberships m
       join users u on u.id = m.user_id
       cross join generate_series(1, $2::int) as n
       where u.email = $1 and m.role = 'owner'`,
      [ownerEmail, count],
    );
    if (rowCount !== count) throw new Error(`Seeded ${rowCount} customers for ${ownerEmail}, expected ${count}`);
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

/**
 * Test-only: the latest email queued for `to`, as `status` ("pending", "sent" or "failed") and how many
 * times a send was tried. A production build in a test run has no mail provider, so a send is tried and
 * fails (it stays "pending" with an attempt on record); a development server prints it and marks it "sent".
 */
export async function latestEmailDelivery(to: string): Promise<{ status: string; attempts: number } | undefined> {
  const { Client } = await import("pg");
  const { testDatabaseUrl } = await import("../src/db/testing/env");
  const client = new Client({ connectionString: testDatabaseUrl() });
  await client.connect();
  try {
    const { rows } = await client.query<{ status: string; attempts: number }>(
      "select status, attempts from outbox_messages where payload->>'to' = $1 order by created_at desc limit 1",
      [to],
    );
    return rows[0];
  } finally {
    await client.end();
  }
}

/**
 * Runs the daily job on the test server, the way Vercel Cron calls it: it makes a draft for every recurring
 * schedule that is due today (a business's "today" is its own time zone's), and is safe to run twice.
 * The server's cron secret is made fresh for each run in playwright.config.ts and never written down.
 */
export async function runDailyJob(page: Page): Promise<{ recurringDrafts: number; recurringPaused: number; failed: number }> {
  const secret = process.env.E2E_CRON_SECRET;
  if (!secret) throw new Error("E2E_CRON_SECRET is not set; run through playwright.config.ts");
  const response = await page.request.get("/api/cron/daily", { headers: { authorization: `Bearer ${secret}` } });
  expect(response.status()).toBe(200);
  return response.json();
}
