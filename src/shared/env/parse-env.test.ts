import { describe, expect, it } from "vitest";
import { parseEnv } from "./parse-env";

describe("parseEnv", () => {
  it("applies defaults when optional variables are missing", () => {
    const env = parseEnv({ NODE_ENV: "development" });

    expect(env.NODE_ENV).toBe("development");
    expect(env.APP_URL).toBe("http://localhost:3200");
  });

  it("treats empty values (VAR= in an env file) as not set", () => {
    const env = parseEnv({
      SMTP_USER: "",
      SMTP_PASSWORD: "",
      EMAIL_FROM: "",
      DATABASE_URL: "",
      APP_URL: "",
    });
    expect(env.SMTP_USER).toBeUndefined();
    expect(env.EMAIL_FROM).toBeUndefined();
    expect(env.DATABASE_URL).toBeUndefined();
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

  describe("email and cron settings", () => {
    it("are optional", () => {
      const env = parseEnv({});
      expect(env.RESEND_API_KEY).toBeUndefined();
      expect(env.EMAIL_FROM).toBeUndefined();
      expect(env.CRON_SECRET).toBeUndefined();
    });

    it("accept a Resend key, a named sender and a long cron secret", () => {
      const env = parseEnv({
        RESEND_API_KEY: "re_123456789",
        EMAIL_FROM: "Tavi <notify@tavi.example>",
        CRON_SECRET: "c".repeat(32),
      });
      expect(env.EMAIL_FROM).toBe("Tavi <notify@tavi.example>");
    });

    it("reject a malformed sender, a non-Resend key and a short cron secret, without echoing them", () => {
      let message = "";
      try {
        parseEnv({ RESEND_API_KEY: "sk_live_wrong", EMAIL_FROM: "notify at tavi", CRON_SECRET: "short" });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(/RESEND_API_KEY/);
      expect(message).toMatch(/EMAIL_FROM must look like/);
      expect(message).toMatch(/CRON_SECRET must be at least 32 characters/);
      expect(message).not.toContain("sk_live_wrong");
    });
  });

  describe("Gmail SMTP settings (D11)", () => {
    it("default to Gmail's TLS endpoint", () => {
      const env = parseEnv({});
      expect(env.SMTP_HOST).toBe("smtp.gmail.com");
      expect(env.SMTP_PORT).toBe(465);
      expect(env.SMTP_USER).toBeUndefined();
    });

    it("accept an account, an app password and a custom port", () => {
      const env = parseEnv({ SMTP_USER: "tavi.notify@gmail.com", SMTP_PASSWORD: "abcd efgh ijkl mnop", SMTP_PORT: "587" });
      expect(env.SMTP_PORT).toBe(587);
      expect(env.SMTP_USER).toBe("tavi.notify@gmail.com");
    });

    it("reject a malformed account and port, without echoing the password", () => {
      let message = "";
      try {
        parseEnv({ SMTP_USER: "not-an-email", SMTP_PORT: "smtp", SMTP_PASSWORD: "abcd efgh ijkl mnop" });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(/SMTP_USER must be an email address/);
      expect(message).toMatch(/SMTP_PORT/);
      expect(message).not.toContain("abcd efgh");
    });
  });
});
