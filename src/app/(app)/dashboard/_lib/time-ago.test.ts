import { describe, expect, it } from "vitest";
import { timeAgo } from "./time-ago";

const now = new Date("2026-10-01T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("timeAgo", () => {
  it("speaks in the business's locale, at the largest whole unit", () => {
    expect(timeAgo(ago(20_000), now, "en-PH")).toBe("now");
    expect(timeAgo(ago(5 * 60_000), now, "en-PH")).toBe("5 minutes ago");
    expect(timeAgo(ago(2 * 3_600_000), now, "en-PH")).toBe("2 hours ago");
    expect(timeAgo(ago(26 * 3_600_000), now, "en-PH")).toBe("yesterday");
    expect(timeAgo(ago(9 * 86_400_000), now, "en-PH")).toBe("last week");
  });
});
