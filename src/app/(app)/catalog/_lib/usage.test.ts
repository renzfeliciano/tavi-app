import { describe, expect, it } from "vitest";
import type { CatalogItem } from "@/modules/catalog";
import { catalogRows, usedTimes } from "./usage";

const item = (id: string, over: Partial<CatalogItem> = {}): CatalogItem => ({
  kind: "service",
  id,
  name: `Item ${id}`,
  description: null,
  sku: null,
  unitLabel: "hour",
  unitPriceMinor: 50_000,
  currency: "PHP",
  taxRateId: null,
  archivedAt: null,
  ...over,
});

describe("usedTimes", () => {
  it.each([
    [1, "Used once"],
    [2, "Used 2 times"],
    [12, "Used 12 times"],
  ])("says %i as %s", (count, words) => {
    expect(usedTimes(count)).toBe(words);
  });
});

describe("catalogRows", () => {
  const today = "2026-10-14";
  const usage = new Map([
    ["a", { count: 3, lastOn: "2026-10-13" }],
    ["c", { count: 1, lastOn: "2026-08-02" }],
  ]);

  it("gives each listed item when it was last used and how often, in the order they came", () => {
    const rows = catalogRows({ items: [item("a"), item("b"), item("c")], usage, today, locale: "en-PH" });

    expect(rows.map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(rows[0]?.use).toEqual({ count: 3, when: "Yesterday" });
    expect(rows[2]?.use).toEqual({ count: 1, when: "Aug 2, 2026" });
  });

  it("has no use for an item no sent quotation or issued statement carries", () => {
    const rows = catalogRows({ items: [item("b")], usage, today, locale: "en-PH" });

    expect(rows[0]?.use).toBeNull();
  });

  it("keeps everything else about the item", () => {
    const rows = catalogRows({ items: [item("a", { name: "Aircon cleaning", sku: "AC-1" })], usage, today, locale: "en-PH" });

    expect(rows[0]).toMatchObject({ name: "Aircon cleaning", sku: "AC-1", unitPriceMinor: 50_000 });
  });
});
