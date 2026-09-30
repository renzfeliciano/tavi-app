import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "./errors";

const pg = (code: string, constraint?: string) => Object.assign(new Error("pg"), { code, constraint });

describe("isUniqueViolation", () => {
  it("finds the Postgres error in Drizzle's cause chain", () => {
    const wrapped = new Error("Failed query", { cause: pg("23505", "tax_rates_active_name_unique") });

    expect(isUniqueViolation(wrapped)).toBe(true);
    expect(isUniqueViolation(wrapped, "tax_rates_active_name_unique")).toBe(true);
  });

  it("is false for another constraint or another error", () => {
    expect(isUniqueViolation(pg("23505", "other"), "tax_rates_active_name_unique")).toBe(false);
    expect(isUniqueViolation(pg("23503"))).toBe(false);
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
