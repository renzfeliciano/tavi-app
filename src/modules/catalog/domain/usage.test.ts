import { describe, expect, it } from "vitest";
import { type ItemUse, mergeUse } from "./usage";

const use = (itemId: string, count: number, lastOn: string): ItemUse => ({ itemId, count, lastOn });

describe("how much an item has been used", () => {
  it("adds up what each kind of document used it for and keeps the latest day", () => {
    const quotes = [use("cleaning", 3, "2026-10-01")];
    const invoices = [use("cleaning", 2, "2026-10-09")];
    expect(mergeUse([quotes, invoices]).get("cleaning")).toEqual({ count: 5, lastOn: "2026-10-09" });
  });

  it("keeps the latest day whichever kind of document it came from", () => {
    const quotes = [use("cleaning", 1, "2026-10-12")];
    const invoices = [use("cleaning", 4, "2026-10-02")];
    expect(mergeUse([quotes, invoices]).get("cleaning")).toEqual({ count: 5, lastOn: "2026-10-12" });
  });

  it("reports an item that only one kind of document used as it was", () => {
    const merged = mergeUse([[use("cleaning", 2, "2026-10-01")], [use("filter", 1, "2026-09-20")]]);
    expect(merged.get("cleaning")).toEqual({ count: 2, lastOn: "2026-10-01" });
    expect(merged.get("filter")).toEqual({ count: 1, lastOn: "2026-09-20" });
  });

  it("has nothing for an item that was never used", () => {
    expect(mergeUse([[use("cleaning", 2, "2026-10-01")], []]).has("filter")).toBe(false);
    expect(mergeUse([]).size).toBe(0);
  });
});
