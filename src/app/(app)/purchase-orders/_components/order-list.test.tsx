import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type OrderRow, orderColumns, orderSummary } from "./order-list";

const order = (over: Partial<OrderRow> = {}): OrderRow =>
  ({
    id: "o1",
    number: "PO-000007",
    status: "ISSUED",
    currency: "PHP",
    totalMinor: 250_000,
    orderDate: "2026-10-01",
    expectedDate: "2026-10-15",
    receivedDate: null,
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    supplierName: "Santos Hardware",
    ...over,
  }) as OrderRow;

const columns = orderColumns("en-PH");
const cell = (id: string, row: OrderRow) => {
  const column = columns.find((c) => c.id === id);
  if (!column) throw new Error(`no ${id} column`);
  return render(<>{column.cell(row)}</>);
};

describe("purchase order list columns", () => {
  it("has columns for supplier and number, dates, status and amount", () => {
    expect(columns.map((c) => c.id)).toEqual(["supplier", "dates", "status", "amount"]);
  });

  it("leads with the supplier and puts the number under it", () => {
    cell("supplier", order());
    expect(screen.getByText("Santos Hardware")).toBeInTheDocument();
    expect(screen.getByText("PO-000007")).toBeInTheDocument();
  });

  it("calls an unnumbered draft a draft, and a draft with no supplier yet says so", () => {
    cell("supplier", order({ number: null, status: "DRAFT", supplierName: null }));
    expect(screen.getByText("No supplier yet")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("shows the order date with the expected date under it", () => {
    cell("dates", order());
    expect(screen.getByText("Oct 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("Expected Oct 15, 2026")).toBeInTheDocument();
  });

  it("says Received with the day it arrived once received, and nothing when no date was set", () => {
    const received = cell("dates", order({ status: "RECEIVED", receivedDate: "2026-10-12" }));
    expect(screen.getByText("Received Oct 12, 2026")).toBeInTheDocument();
    received.unmount();
    cell("dates", order({ expectedDate: null }));
    expect(screen.queryByText(/Expected/)).toBeNull();
  });

  it("shows the status in words", () => {
    cell("status", order({ status: "CANCELLED" }));
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("strikes a cancelled order's amount through", () => {
    const { container } = cell("amount", order({ status: "CANCELLED" }));
    expect(container.querySelector(".line-through")).not.toBeNull();
  });

  it("sums an order up for a phone: status in words, then when it was ordered and expected", () => {
    const { container, unmount } = render(<>{orderSummary("en-PH")(order())}</>);
    expect(screen.getByText("Issued")).toBeInTheDocument();
    expect(container).toHaveTextContent("Ordered Oct 1, 2026");
    expect(container).toHaveTextContent("Expected Oct 15, 2026");
    unmount();
    const bare = render(<>{orderSummary("en-PH")(order({ expectedDate: null }))}</>);
    expect(bare.container).not.toHaveTextContent("Expected");
  });
});
