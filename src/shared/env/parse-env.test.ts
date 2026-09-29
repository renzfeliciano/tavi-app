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
});
