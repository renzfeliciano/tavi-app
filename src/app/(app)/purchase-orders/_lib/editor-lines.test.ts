import { describe, expect, it } from "vitest";
import type { PurchaseOrderLine } from "@/modules/purchasing";
import { toEditorLines } from "./editor-lines";

const stored = (over: Partial<PurchaseOrderLine> = {}): PurchaseOrderLine => ({
  position: 0,
  description: "Copy paper",
  unitLabel: "box",
  quantity: 25_000,
  unitPriceMinor: 150_050,
  discountKind: null,
  discountValue: null,
  taxRateId: null,
  taxRateName: null,
  taxRateBps: null,
  grossMinor: 0,
  discountMinor: 0,
  taxMinor: 0,
  totalMinor: 0,
  ...over,
});

describe("toEditorLines", () => {
  it("turns stored numbers back into what a person types", () => {
    expect(toEditorLines([stored()], "PHP", "en-PH")).toEqual([
      {
        key: "line-0",
        description: "Copy paper",
        quantity: "2.5",
        unitLabel: "box",
        unitPrice: "1,500.50",
        discountKind: "none",
        discountValue: "",
        taxRateId: "",
        sourceKind: "",
        sourceId: "",
      },
    ]);
  });

  it("keeps a percent discount and a tax rate choice", () => {
    const [line] = toEditorLines([stored({ discountKind: "percent", discountValue: 1_000, taxRateId: "t-1" })], "PHP", "en-PH");
    expect(line).toMatchObject({ discountKind: "percent", discountValue: "10", taxRateId: "t-1" });
  });

  it("keeps an amount discount in the currency's decimals", () => {
    const [line] = toEditorLines([stored({ discountKind: "amount", discountValue: 5_000 })], "PHP", "en-PH");
    expect(line).toMatchObject({ discountKind: "amount", discountValue: "50.00" });
  });
});
