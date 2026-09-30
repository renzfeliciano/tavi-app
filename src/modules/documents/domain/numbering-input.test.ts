import { describe, expect, it } from "vitest";
import { numberingInputSchema } from "./numbering-input";

describe("numberingInputSchema", () => {
  it("accepts an uppercase prefix and a digit count", () => {
    expect(numberingInputSchema.parse({ prefix: "acme-q-", padding: "5" })).toEqual({ prefix: "ACME-Q-", padding: 5 });
  });

  it("allows an empty prefix", () => {
    expect(numberingInputSchema.parse({ prefix: "", padding: "6" })).toEqual({ prefix: "", padding: 6 });
  });

  it("explains an invalid prefix or digit count", () => {
    const result = numberingInputSchema.safeParse({ prefix: "Q 1/", padding: "2" });
    expect(result.success).toBe(false);
    const errors = result.success ? {} : result.error.flatten().fieldErrors;
    expect(errors).toMatchObject({
      prefix: ["Use up to 12 letters, digits or dashes."],
      padding: ["Choose between 3 and 10 digits."],
    });
  });
});
