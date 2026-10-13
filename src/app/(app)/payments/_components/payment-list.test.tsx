import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import { type PaymentRow, paymentColumns } from "./payment-list";

const payment = (over: Partial<PaymentRow> = {}): PaymentRow => ({
  id: "p1",
  receiptNumber: "OR-000001",
  invoiceId: "i1",
  invoiceNumber: "INV-000012",
  customerName: "Maria Santos",
  payerName: null,
  method: "ewallet",
  reference: "GC-1",
  amountMinor: 150_000,
  withheldMinor: 0,
  currency: "PHP",
  paidOn: "2026-10-01",
  institution: null,
  paidTime: null,
  chequeDate: null,
  notes: null,
  voidedAt: null,
  voidReason: null,
  createdAt: new Date("2026-10-01T02:00:00Z"),
  ...over,
});

const cell = (id: string, row: PaymentRow) => {
  const column = paymentColumns("en-PH", MARKETS.PH).find((c) => c.id === id);
  if (!column) throw new Error(`no ${id} column`);
  return render(<>{column.cell(row)}</>);
};

describe("payment list columns", () => {
  it("sets the invoice a payment was for in the same small type as the cells beside it", () => {
    cell("invoice", payment());

    expect(screen.getByText("INV-000012").closest("span")).toHaveClass("text-sm");
  });

  it("says Draft where the payment's invoice has no number yet", () => {
    cell("invoice", payment({ invoiceNumber: null }));

    expect(screen.getByText("Draft")).toBeInTheDocument();
  });
});
