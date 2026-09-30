import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { testDatabaseUrl } from "./src/db/testing/env";

// E2E runs its own server on :3201 against the Neon `test` branch (or CI's
// Postgres), never the dev database or a dev server you already have open.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const PORT = 3201;
const baseURL = `http://localhost:${PORT}`;
const isCI = Boolean(process.env.CI);
const databaseUrl = testDatabaseUrl();

export const OWNER_STATE = "e2e/.auth/owner.json";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  // Locally the dev server compiles each page on first visit (and Neon may be
  // waking up), so allow slower first responses; CI runs a production build.
  expect: { timeout: isCI ? 5_000 : 20_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    // Signs up one owner, creates their business and saves the session.
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { ...devices["Desktop Chrome"] } },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], storageState: OWNER_STATE },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], storageState: OWNER_STATE },
      dependencies: ["setup"],
      // Sign-in flows create accounts; run them once (desktop) to stay under
      // the production sign-up rate limit.
      testIgnore: [/auth\.setup\.ts/, /auth\.spec\.ts/],
    },
  ],
  webServer: {
    command: isCI
      ? `npm run build && npx next start --port ${PORT}`
      : `npx next dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      DATABASE_URL: databaseUrl,
      DATABASE_URL_DIRECT: databaseUrl,
      APP_URL: baseURL,
      // Never send real email from test runs: test accounts use @example.com,
      // and bounces would hurt the sending account's reputation.
      RESEND_API_KEY: "",
      SMTP_USER: "",
      SMTP_PASSWORD: "",
    },
  },
});
