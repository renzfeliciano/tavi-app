import { describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import { paymentProofRows } from "./payment-proof";

const market = MARKETS.PH;
const none = { reference: null, institution: null, payerName: null, paidTime: null, chequeDate: null };
const date = (d: string) => `<${d}>`;

describe("paymentProofRows", () => {
  it("is empty when nothing was typed", () => {
    expect(paymentProofRows({ method: "cash", ...none }, market, date)).toEqual([]);
  });

  it("labels each typed detail for the method it was paid by", () => {
    const rows = paymentProofRows(
      { method: "ewallet", reference: "7845 2210 9", institution: "GCash", payerName: "Juan D.C.", paidTime: "14:30", chequeDate: null },
      market,
      date,
    );
    expect(rows).toEqual([
      { label: "Reference no.", value: "7845 2210 9" },
      { label: "Wallet (GCash, Maya…)", value: "GCash" },
      { label: "Sender (name or number)", value: "Juan D.C." },
      { label: "Time paid", value: "2:30 PM" },
    ]);
  });

  it("calls a cheque's and a deposit slip's numbers by their own names", () => {
    const cheque = paymentProofRows(
      { method: "cheque", reference: "0001234", institution: "BDO", payerName: null, paidTime: null, chequeDate: "2026-10-20" },
      market,
      date,
    );
    expect(cheque).toEqual([
      { label: "Cheque no.", value: "0001234" },
      { label: "Bank on the cheque", value: "BDO" },
      { label: "Date on the cheque", value: "<2026-10-20>" },
    ]);
    const slip = paymentProofRows({ method: "bank_deposit", ...none, reference: "SLIP-88", institution: "BPI" }, market, date);
    expect(slip.map((r) => r.label)).toEqual(["Deposit slip no.", "Bank"]);
  });

  it("skips the bank for methods that have none, even if one is stored", () => {
    expect(paymentProofRows({ method: "cash", ...none, institution: "BDO" }, market, date)).toEqual([]);
  });
});
