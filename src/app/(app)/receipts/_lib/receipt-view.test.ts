import { describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import type { Receipt } from "@/modules/payments";
import { receiptView } from "./receipt-view";

const market = MARKETS.PH;
const business = { name: "Santos Aircon", subtitle: null, addressLines: [], contactLines: [], taxId: null, logo: null, paymentQrs: [] };
const options = { business, market, locale: "en-PH" };
const base = {
  id: "r1",
  kind: "collection",
  receiptNumber: "REC-000007",
  customerId: null,
  payerName: "Maria Santos",
  amountMinor: 150_000,
  currency: "PHP",
  receivedOn: "2026-10-01",
  method: "cash",
  reference: null,
  institution: null,
  paidTime: null,
  chequeDate: null,
  purpose: "Reimbursement of fuel",
  notes: null,
  voidedAt: null,
  voidReason: null,
} as unknown as Receipt;

describe("receiptView", () => {
  it("titles a receipt from the market and keeps its number", () => {
    const view = receiptView(base, options);
    expect(view.title).toBe(market.documents.receiptKinds.collection.title);
    expect(receiptView({ ...base, kind: "acknowledgement" }, options).title).toBe(market.documents.receiptKinds.acknowledgement.title);
    expect(view.number).toBe("REC-000007");
    expect(view.amount).toBe("₱1,500.00");
  });

  it("prints the payer as typed, with no customer details", () => {
    expect(receiptView(base, options).customer).toEqual({ name: "Maria Santos", subtitle: null, addressLines: [], contactLines: [], taxId: null });
  });

  it("lists date, method, proof rows, then what it was for", () => {
    const view = receiptView({ ...base, method: "cheque", reference: "0001234", institution: "BDO", chequeDate: "2026-10-20" }, options);
    expect(view.details.map((d) => d.label)).toEqual(["Date received", "Method", "Cheque no.", "Bank on the cheque", "Date on the cheque", "For"]);
    expect(view.details.at(-1)).toEqual({ label: "For", value: "Reimbursement of fuel" });
  });

  it("adds the note after what it was for when there is one", () => {
    const view = receiptView({ ...base, notes: "Paid in two parts" }, options);
    expect(view.details.at(-1)).toEqual({ label: "Note", value: "Paid in two parts" });
  });

  it("says why a void receipt is void", () => {
    expect(receiptView({ ...base, voidedAt: new Date("2026-10-02T00:00:00Z"), voidReason: "Wrong amount" }, options).voided).toBe("Voided: Wrong amount");
    expect(receiptView(base, options).voided).toBeNull();
  });

  it("takes the notice and disclaimer from the market", () => {
    const view = receiptView(base, options);
    expect(view.notice).toBe(market.supplementaryDocumentNotice);
    expect(view.disclaimer).toBe(market.documents.receipt.disclaimer ?? null);
  });

  it("leaves markup in the payer name untouched as plain text", () => {
    const view = receiptView({ ...base, payerName: "<script>alert(1)</script>" }, options);
    expect(view.customer?.name).toBe("<script>alert(1)</script>");
  });
});
