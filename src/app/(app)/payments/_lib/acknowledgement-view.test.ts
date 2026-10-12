import { describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import { acknowledgementView } from "./acknowledgement-view";

const market = MARKETS.PH;
const business = { name: "Santos Aircon", subtitle: null, addressLines: [], contactLines: [], taxId: null, logo: null, paymentQrs: [] };
const base = {
  receiptNumber: "REC-000001",
  paidOn: "2026-10-01",
  method: "ewallet" as const,
  reference: null,
  institution: null,
  payerName: null,
  paidTime: null,
  chequeDate: null,
  amountMinor: 150000,
  withheldMinor: 0,
  currency: "PHP",
};
const options = { invoiceName: "Billing statement INV-000001", customer: null, business, market, locale: "en-PH" };

describe("acknowledgementView details", () => {
  it("prints every proof-of-payment detail the business typed, labelled for how it was paid", () => {
    const view = acknowledgementView(
      { ...base, reference: "7845 2210 9", institution: "GCash", payerName: "Juan D.C.", paidTime: "14:30" },
      options,
    );
    expect(view.details).toEqual([
      { label: "Date received", value: "Oct 1, 2026" },
      { label: "Method", value: "GCash or Maya" },
      { label: "Reference no.", value: "7845 2210 9" },
      { label: "Wallet (GCash, Maya…)", value: "GCash" },
      { label: "Sender (name or number)", value: "Juan D.C." },
      { label: "Time paid", value: "2:30 PM" },
      { label: "For", value: "Billing statement INV-000001" },
    ]);
  });

  it("prints a post-dated cheque's own date", () => {
    const view = acknowledgementView(
      { ...base, method: "cheque", reference: "0001234", institution: "BDO", chequeDate: "2026-10-20" },
      options,
    );
    expect(view.details.map((d) => d.label)).toEqual([
      "Date received",
      "Method",
      "Cheque no.",
      "Bank on the cheque",
      "Date on the cheque",
      "For",
    ]);
    expect(view.details.find((d) => d.label === "Date on the cheque")?.value).toBe("Oct 20, 2026");
  });

  it("has no proof rows when nothing was typed", () => {
    expect(acknowledgementView(base, options).details.map((d) => d.label)).toEqual(["Date received", "Method", "For"]);
  });
});
