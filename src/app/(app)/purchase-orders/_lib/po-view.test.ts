import { describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import type { PurchaseOrderDetail } from "@/modules/purchasing";
import { purchaseOrderView } from "./po-view";

const market = MARKETS.PH;
const business = { name: "Reyes Aircon", subtitle: null, addressLines: [], contactLines: [], taxId: null, logo: null, paymentQrs: [] };
const options = { business, market, locale: "en-PH" };

const order = (over: Partial<PurchaseOrderDetail> = {}): PurchaseOrderDetail => ({
  id: "po1",
  number: "PO-000001",
  status: "ISSUED",
  supplierId: "s1",
  currency: "PHP",
  taxMode: "exclusive",
  orderDate: "2026-10-01",
  expectedDate: "2026-10-08",
  notes: "Deliver to the back door.",
  terms: null,
  supplierSnapshot: {
    displayName: "Santos Hardware",
    contactName: "Rosa Reyes",
    email: "orders@santos.example",
    phone: "0917 555 0111",
    addressLines: ["12 Mabini St.", "Quezon City"],
    taxId: "123-456-789-00000",
  },
  sellerSnapshot: null,
  subtotalMinor: 291_000,
  discountTotalMinor: 0,
  taxTotalMinor: 0,
  totalMinor: 291_000,
  issuedAt: new Date("2026-10-01T02:00:00Z"),
  receivedDate: null,
  receiptNote: null,
  cancelledAt: null,
  cancelReason: null,
  updatedAt: new Date("2026-10-01T02:00:00Z"),
  supplier: null,
  lines: [
    {
      position: 0,
      description: "Copper pipe 1/2 in",
      unitLabel: "pc",
      quantity: 200_000,
      unitPriceMinor: 14_550,
      discountKind: null,
      discountValue: null,
      taxRateId: null,
      taxRateName: null,
      taxRateBps: null,
      grossMinor: 291_000,
      discountMinor: 0,
      taxMinor: 0,
      totalMinor: 291_000,
    },
  ],
  ...over,
});

describe("purchaseOrderView", () => {
  it("is titled from the market, numbered, and addressed to the supplier as they were when issued", () => {
    const view = purchaseOrderView(order(), options);
    expect(view.title).toBe(market.documents.purchaseOrder.singular);
    expect(view.number).toBe("PO-000001");
    expect(view.partyLabel).toBe("Order to");
    expect(view.customer).toEqual({
      name: "Santos Hardware",
      subtitle: "Rosa Reyes",
      addressLines: ["12 Mabini St.", "Quezon City"],
      contactLines: ["orders@santos.example", "0917 555 0111"],
      taxId: { label: market.taxId.label, value: "123-456-789-00000" },
    });
  });

  it("shows the order date and, when there is one, the expected date", () => {
    expect(purchaseOrderView(order(), options).dates.map((d) => d.label)).toEqual(["Date", "Expected by"]);
    expect(purchaseOrderView(order({ expectedDate: null }), options).dates.map((d) => d.label)).toEqual(["Date"]);
  });

  it("adds when it was received, and stamps it", () => {
    const view = purchaseOrderView(order({ status: "RECEIVED", receivedDate: "2026-10-06" }), options);
    expect(view.dates.map((d) => d.label)).toEqual(["Date", "Expected by", "Received"]);
    expect(view.imprint).toBe("Received");
  });

  it("stamps a cancelled order as cancelled", () => {
    expect(purchaseOrderView(order({ status: "CANCELLED" }), options).imprint).toBe("Cancelled");
    expect(purchaseOrderView(order(), options).imprint).toBeNull();
  });

  it("totals the lines with the one calculation and carries the notes and the market's notice", () => {
    const view = purchaseOrderView(order(), options);
    expect(view.lines).toHaveLength(1);
    expect(view.totals.at(-1)).toEqual({ label: "Total", value: "₱2,910.00", emphasis: true });
    expect(view.notes).toBe("Deliver to the back door.");
    expect(view.notice).toBe(market.supplementaryDocumentNotice);
  });

  it("never prints payment instructions: a purchase order asks for no payment", () => {
    expect(purchaseOrderView(order(), options).paymentInstructions).toBeNull();
  });

  it("shows a draft's supplier as chosen now, since nothing is frozen until it is issued", () => {
    const draft = order({
      number: null,
      status: "DRAFT",
      supplierSnapshot: null,
      supplier: { id: "s1", displayName: "Santos Hardware", email: "orders@santos.example", archived: false },
    });
    expect(purchaseOrderView(draft, options).customer).toMatchObject({ name: "Santos Hardware", contactLines: ["orders@santos.example"] });
  });

  it("copes with a supplier that was never snapshotted", () => {
    expect(purchaseOrderView(order({ supplierSnapshot: null }), options).customer).toBeNull();
  });
});
