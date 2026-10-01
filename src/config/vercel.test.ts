import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Deployment settings that are easy to lose and expensive to miss (§K).
const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
  regions?: string[];
  crons?: { path: string; schedule: string }[];
};

describe("vercel.json", () => {
  it("runs functions in Singapore, next to the Neon database (D1)", () => {
    // Vercel's default is Washington (iad1): every query would cross the
    // Pacific, and the dashboard runs about a dozen per request.
    expect(config.regions).toEqual(["sin1"]);
  });

  it("schedules only cron routes that exist", () => {
    for (const { path } of config.crons ?? []) {
      expect(existsSync(`src/app${path}/route.ts`), path).toBe(true);
    }
  });
});
