import { describe, expect, it } from "vitest";
import { firstDraftText } from "./first-draft";

const format = (date: string) => `<${date}>`;

describe("firstDraftText", () => {
  it("names the day when the first due date is still ahead", () => {
    expect(firstDraftText("2026-11-01", "2026-10-15", format)).toBe("The first draft is made on <2026-11-01>.");
  });

  it("says the next daily run when the first due date is today or has passed", () => {
    const text = "The first draft is made in the next daily run, shortly after midnight.";
    expect(firstDraftText("2026-10-15", "2026-10-15", format)).toBe(text);
    expect(firstDraftText("2026-10-01", "2026-10-15", format)).toBe(text);
  });
});
