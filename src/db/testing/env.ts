import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Vitest runs with NODE_ENV=test, and Next's env loader deliberately skips
// .env.local in test mode. Integration tests need TEST_DATABASE_URL from it,
// so load the file directly (Node >= 22). Existing variables win (CI sets its own).
const envFile = resolve(process.cwd(), ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const hostOf = (url: string | undefined): string | null => {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace("-pooler", "");
  } catch {
    return null;
  }
};

/**
 * The integration-test database URL. Refuses to return one that points at the
 * app's own database, because every test run wipes it.
 */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Add the Neon `test` branch connection string (pooling off) to .env.local.",
    );
  }
  const testHost = hostOf(url);
  const appHosts = [process.env.DATABASE_URL, process.env.DATABASE_URL_DIRECT].map(hostOf);
  if (testHost && appHosts.includes(testHost)) {
    throw new Error(
      "Refusing to run: TEST_DATABASE_URL points at the same database as DATABASE_URL. Integration tests wipe their database; use the Neon `test` branch.",
    );
  }
  return url;
}
