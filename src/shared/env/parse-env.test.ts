import { describe, expect, it } from "vitest";
import { parseEnv } from "./parse-env";

describe("parseEnv", () => {
  it("applies defaults when optional variables are missing", () => {
    const env = parseEnv({ NODE_ENV: "development" });

    expect(env.NODE_ENV).toBe("development");
    expect(env.APP_URL).toBe("http://localhost:3200");
  });

  it("defaults NODE_ENV to development", () => {
    expect(parseEnv({}).NODE_ENV).toBe("development");
  });

  it("accepts a valid APP_URL and strips a trailing slash", () => {
    const env = parseEnv({ APP_URL: "https://app.tavi.example/" });

    expect(env.APP_URL).toBe("https://app.tavi.example");
  });

  it("rejects an APP_URL that is not http(s)", () => {
    expect(() => parseEnv({ APP_URL: "ftp://tavi.example" })).toThrow(
      /APP_URL/,
    );
  });

  it("allows http://localhost in production, for local and CI builds", () => {
    const base = {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://u:p@h/db",
      BETTER_AUTH_SECRET: "x".repeat(32),
    };
    expect(parseEnv({ ...base, APP_URL: "http://localhost:3201" }).APP_URL).toBe(
      "http://localhost:3201",
    );
    expect(() => parseEnv({ ...base, APP_URL: "http://localhost.evil.example" })).toThrow(
      /https in production/,
    );
  });

  it("requires APP_URL to use https in production", () => {
    expect(() =>
      parseEnv({ NODE_ENV: "production", APP_URL: "http://tavi.example" }),
    ).toThrow(/APP_URL must use https in production/);
  });

  it("rejects an unknown NODE_ENV", () => {
    expect(() => parseEnv({ NODE_ENV: "staging" })).toThrow(/NODE_ENV/);
  });

  it("names every invalid variable but never echoes its value", () => {
    const secretLooking = "ftp://user:super-secret@tavi.example";

    let message = "";
    try {
      parseEnv({ NODE_ENV: "staging", APP_URL: secretLooking });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toMatch(/NODE_ENV/);
    expect(message).toMatch(/APP_URL/);
    expect(message).not.toContain("super-secret");
  });

  describe("database URLs", () => {
    const pg = "postgresql://user:secret-pw@ep-x.example.neon.tech/tavi?sslmode=require";

    it("are optional outside production", () => {
      const env = parseEnv({ NODE_ENV: "development" });
      expect(env.DATABASE_URL).toBeUndefined();
      expect(env.TEST_DATABASE_URL).toBeUndefined();
    });

    it("accepts postgres:// and postgresql:// URLs", () => {
      const env = parseEnv({
        DATABASE_URL: pg,
        DATABASE_URL_DIRECT: pg.replace("postgresql:", "postgres:"),
        TEST_DATABASE_URL: pg,
      });
      expect(env.DATABASE_URL).toBe(pg);
      expect(env.DATABASE_URL_DIRECT).toMatch(/^postgres:/);
    });

    it("rejects a URL that isn't Postgres, without echoing it", () => {
      let message = "";
      try {
        parseEnv({ DATABASE_URL: "mongodb://user:secret-pw@cluster/tavi" });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(/DATABASE_URL must be a postgres/);
      expect(message).not.toContain("secret-pw");
    });

    it("requires DATABASE_URL in production", () => {
      expect(() =>
        parseEnv({ NODE_ENV: "production", APP_URL: "https://tavi.example" }),
      ).toThrow(/DATABASE_URL is required in production/);
    });
  });

  describe("BETTER_AUTH_SECRET", () => {
    const secret = "x".repeat(32);

    it("is optional in development", () => {
      expect(parseEnv({ NODE_ENV: "development" }).BETTER_AUTH_SECRET).toBeUndefined();
    });

    it("must be at least 32 characters, and is never echoed", () => {
      let message = "";
      try {
        parseEnv({ BETTER_AUTH_SECRET: "short-secret-value" });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(/BETTER_AUTH_SECRET must be at least 32 characters/);
      expect(message).not.toContain("short-secret-value");
    });

    it("is required in production", () => {
      expect(() =>
        parseEnv({
          NODE_ENV: "production",
          APP_URL: "https://tavi.example",
          DATABASE_URL: "postgresql://u:p@h/db",
        }),
      ).toThrow(/BETTER_AUTH_SECRET is required in production/);
    });

    it("accepts a long enough secret", () => {
      expect(parseEnv({ BETTER_AUTH_SECRET: secret }).BETTER_AUTH_SECRET).toBe(secret);
    });
  });
});
