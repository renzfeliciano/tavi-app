import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import { type ReceiptRow, receiptColumns, receiptSummary } from "./receipt-list";

const receipt = (over: Partial<ReceiptRow> = {}): ReceiptRow =>
  ({
    id: "r1",
    kind: "collection",
    receiptNumber: "REC-000007",
    payerName: "Maria Santos",
    amountMinor: 150_000,
    currency: "PHP",
    receivedOn: "2026-10-01",
    purpose: "Reimbursement of fuel",
    voidedAt: null,
    ...over,
  }) as ReceiptRow;

const columns = receiptColumns("en-PH", MARKETS.PH);
const cell = (id: string, row: ReceiptRow) => {
  const column = columns.find((c) => c.id === id);
  if (!column) throw new Error(`no ${id} column`);
  return render(<>{column.cell(row)}</>);
};

describe("receipt list columns", () => {
  it("has a column each for payer and number, what it was for, date and title, and amount", () => {
    expect(columns.map((c) => c.id)).toEqual(["payer", "purpose", "received", "amount"]);
  });

  it("shows the payer with the receipt number under them", () => {
    cell("payer", receipt());
    expect(screen.getByText("Maria Santos")).toBeInTheDocument();
    expect(screen.getByText("REC-000007")).toBeInTheDocument();
    expect(screen.queryByText(/Voided/)).toBeNull();
  });

  it("says Voided in words beside the number, not by colour alone", () => {
    cell("payer", receipt({ voidedAt: new Date("2026-10-02T00:00:00Z") }));
    expect(screen.getByText("REC-000007")).toBeInTheDocument();
    expect(screen.getByText(/Voided/)).toBeInTheDocument();
  });

  it("shows what it was for", () => {
    cell("purpose", receipt());
    expect(screen.getByText("Reimbursement of fuel")).toBeInTheDocument();
  });

  it("shows the date with the receipt's title from the market", () => {
    cell("received", receipt({ kind: "acknowledgement" }));
    expect(screen.getByText("Oct 1, 2026")).toBeInTheDocument();
    expect(screen.getByText(MARKETS.PH.documents.receiptKinds.acknowledgement.title)).toBeInTheDocument();
  });

  it("strikes a void receipt's amount through", () => {
    const { container } = cell("amount", receipt({ voidedAt: new Date("2026-10-02T00:00:00Z") }));
    expect(container.querySelector(".line-through")).not.toBeNull();
  });

  it("sums a receipt up for a phone", () => {
    expect(receiptSummary("en-PH", MARKETS.PH)(receipt())).toBe("Oct 1, 2026 · Collection receipt · Reimbursement of fuel");
  });
});
