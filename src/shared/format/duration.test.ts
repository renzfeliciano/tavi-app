import { describe, expect, it } from "vitest";
import { describeDuration } from "./duration";

describe("describeDuration", () => {
  it.each([
    [30 * 60, "30 minutes"],
    [60, "1 minute"],
    [60 * 60, "1 hour"],
    [24 * 60 * 60, "24 hours"],
    [7 * 24 * 60 * 60, "7 days"],
    [30 * 24 * 60 * 60, "30 days"],
    [90 * 60, "90 minutes"],
  ])("%i seconds reads as %s", (seconds, text) => {
    expect(describeDuration(seconds)).toBe(text);
  });
});
