import { describe, expect, it } from "vitest";
import { EMPTY_STAGE, stageFrom } from "./stage";

describe("stageFrom", () => {
  it("adds up a stage's count and what it is worth, and keeps each currency's own count and worth, never summed across currencies", () => {
    expect(
      stageFrom([
        { currency: "USD", count: 1, totalMinor: 5_000 },
        { currency: "PHP", count: 2, totalMinor: 150_000 },
      ]),
    ).toEqual({
      count: 3,
      totals: [
        { currency: "PHP", count: 2, totalMinor: 150_000 },
        { currency: "USD", count: 1, totalMinor: 5_000 },
      ],
    });
  });

  it("leaves out a currency with nothing in it", () => {
    expect(stageFrom([{ currency: "USD", count: 0, totalMinor: 0 }, { currency: "PHP", count: 1, totalMinor: 100 }])).toEqual({
      count: 1,
      totals: [{ currency: "PHP", count: 1, totalMinor: 100 }],
    });
  });

  it("is empty when nothing is in the stage", () => {
    expect(stageFrom([])).toEqual(EMPTY_STAGE);
    expect(EMPTY_STAGE).toEqual({ count: 0, totals: [] });
  });
});
