import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { testDatabaseUrl } from "./env";

const KEYS = ["TEST_DATABASE_URL", "DATABASE_URL", "DATABASE_URL_DIRECT"] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("testDatabaseUrl", () => {
  it("explains what to do when TEST_DATABASE_URL is missing", () => {
    expect(() => testDatabaseUrl()).toThrow(/TEST_DATABASE_URL is not set/);
  });

  it("refuses to point at the app's database, even via the pooler host", () => {
    process.env.DATABASE_URL = "postgresql://u:p@ep-dev-123-pooler.neon.tech/tavi";
    process.env.TEST_DATABASE_URL = "postgresql://u:p@ep-dev-123.neon.tech/tavi";
    expect(() => testDatabaseUrl()).toThrow(/Refusing to run/);
  });

  it("refuses to point at the direct app connection", () => {
    process.env.DATABASE_URL_DIRECT = "postgresql://u:p@ep-dev-123.neon.tech/tavi";
    process.env.TEST_DATABASE_URL = "postgresql://u:p@ep-dev-123.neon.tech/tavi";
    expect(() => testDatabaseUrl()).toThrow(/Refusing to run/);
  });

  it("returns a separate test database", () => {
    process.env.DATABASE_URL = "postgresql://u:p@ep-dev-123-pooler.neon.tech/tavi";
    process.env.TEST_DATABASE_URL = "postgresql://u:p@ep-test-456.neon.tech/tavi";
    expect(testDatabaseUrl()).toBe(process.env.TEST_DATABASE_URL);
  });
});
