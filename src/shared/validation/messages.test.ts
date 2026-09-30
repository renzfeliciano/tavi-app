import { describe, expect, it } from "vitest";
import { dayRange, tooLong } from "./messages";

describe("validation messages", () => {
  it("state the limit they enforce", () => {
    expect(tooLong(40)).toBe("Use 40 characters or fewer.");
    expect(tooLong(2000)).toBe("Use 2,000 characters or fewer.");
    expect(dayRange({ min: 0, max: 365 })).toBe("Choose between 0 and 365 days.");
  });
});
