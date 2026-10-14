import { describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import { trashItemKindName, trashItemName } from "./trash-names";

const market = MARKETS.PH;
const item = (kind: Parameters<typeof trashItemKindName>[0]["kind"], label: string | null = null, customerName: string | null = "Juan Dela Cruz") => ({
  kind,
  label,
  customerName,
});

describe("how the recycle bin names what was deleted", () => {
  it("calls a deleted draft a draft, in the market's own words", () => {
    expect(trashItemKindName(item("quote"), market)).toBe("Quotation draft");
    expect(trashItemKindName(item("invoice"), market)).toBe("Billing statement draft");
  });

  it("calls the rest by their document name and number", () => {
    expect(trashItemKindName(item("sent_quote", "QUO-000012"), market)).toBe("Quotation QUO-000012");
    expect(trashItemKindName(item("payment", "PAR-000003"), market)).toBe("Payment acknowledgement PAR-000003");
    expect(trashItemKindName(item("certificate", "Dela Cruz Trading, Q3 2026"), market)).toBe("BIR Form 2307 · Dela Cruz Trading, Q3 2026");
  });

  it("still names an item whose number is missing", () => {
    expect(trashItemKindName(item("sent_quote"), market)).toBe("Quotation");
    expect(trashItemKindName(item("payment"), market)).toBe("Payment acknowledgement");
    expect(trashItemKindName(item("certificate"), market)).toBe("BIR Form 2307");
  });

  it("adds who it was for, for the confirm dialog and the toast", () => {
    expect(trashItemName(item("sent_quote", "QUO-000012"), market)).toBe("Quotation QUO-000012 for Juan Dela Cruz");
    expect(trashItemName(item("quote", null, null), market)).toBe("Quotation draft");
  });
});
