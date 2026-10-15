import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocumentPaper } from "./document-paper";
import { buildDocumentView } from "./document-view";
import { calculateDocument } from "@/modules/documents/client";

const lines = [{ description: "Aircon cleaning", quantity: 10000, unitLabel: "unit", unitPriceMinor: 150000, discount: null, tax: null }];

function paper(paymentQrs: { label: string; value: string }[], paymentInstructions: string | null) {
  const view = buildDocumentView({
    title: "Billing statement",
    number: "INV-000001",
    revision: 1,
    business: { name: "Santos Aircon", subtitle: null, addressLines: [], contactLines: [], taxId: null, logo: null, paymentQrs },
    customer: null,
    currency: "PHP",
    locale: "en-PH",
    taxMode: "exclusive",
    dates: [{ label: "Date", date: "2026-10-01" }],
    lines,
    amounts: calculateDocument({ taxMode: "exclusive", lines: lines.map(({ unitPriceMinor, quantity, discount, tax }) => ({ unitPriceMinor, quantity, discount, tax })) }),
    notes: null,
    terms: null,
    paymentInstructions,
    notice: null,
  });
  return render(<DocumentPaper view={view} />);
}

describe("DocumentPaper payment QR codes", () => {
  it("shows each QR under How to pay, labelled, beside the written instructions", () => {
    paper(
      [
        { label: "GCash", value: "https://pay.example/a" },
        { label: "Maya", value: "https://pay.example/b" },
      ],
      "GCash 0917 123 4567",
    );
    const box = screen.getByRole("region", { name: "How to pay" });
    expect(within(box).getByText("GCash 0917 123 4567")).toBeTruthy();
    expect(within(box).getByRole("img", { name: "GCash QR code" })).toBeTruthy();
    expect(within(box).getByRole("img", { name: "Maya QR code" })).toBeTruthy();
  });

  it("shows the QRs alone when there are no written instructions (quotes)", () => {
    paper([{ label: "GCash", value: "https://pay.example/a" }], null);
    expect(within(screen.getByRole("region", { name: "How to pay" })).getByRole("img", { name: "GCash QR code" })).toBeTruthy();
  });

  it("has no How to pay box when there is nothing to pay with", () => {
    paper([], null);
    expect(screen.queryByRole("region", { name: "How to pay" })).toBeNull();
  });
});

describe("DocumentPaper party label", () => {
  const base = {
    title: "Purchase order",
    number: "PO-000001",
    revision: 1,
    business: { name: "Reyes Aircon", subtitle: null, addressLines: [], contactLines: [], taxId: null, logo: null, paymentQrs: [] },
    customer: { name: "Santos Hardware", subtitle: null, addressLines: [], contactLines: [], taxId: null },
    currency: "PHP",
    locale: "en-PH",
    taxMode: "exclusive" as const,
    dates: [{ label: "Date", date: "2026-10-01" }],
    lines,
    amounts: calculateDocument({ taxMode: "exclusive", lines: lines.map(({ unitPriceMinor, quantity, discount, tax }) => ({ unitPriceMinor, quantity, discount, tax })) }),
    notes: null,
    terms: null,
    notice: null,
  };

  it("says Billed to unless the document names its own label", () => {
    render(<DocumentPaper view={buildDocumentView(base)} />);
    expect(screen.getByText("Billed to")).toBeInTheDocument();
  });

  it("uses the document's own label, such as Order to on a purchase order", () => {
    render(<DocumentPaper view={buildDocumentView({ ...base, partyLabel: "Order to" })} />);
    expect(screen.getByText("Order to")).toBeInTheDocument();
    expect(screen.queryByText("Billed to")).toBeNull();
  });
});
