import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PendingGroup } from "@/modules/payments";
import { pendingColumns, pendingSummaryLine } from "./pending-list";

const group = (over: Partial<PendingGroup> = {}): PendingGroup => ({
  customerId: "u1",
  customerName: "Juan Dela Cruz",
  currency: "PHP",
  paymentCount: 2,
  withheldMinor: 12_000,
  oldestPaidOn: "2026-07-01",
  ...over,
});

const cell = (id: string, row: PendingGroup) => {
  const column = pendingColumns("en-PH", "2307").find((c) => c.id === id);
  if (!column) throw new Error(`no ${id} column`);
  return render(<>{column.cell(row)}</>);
};

describe("pending list columns", () => {
  it("names the customer and how many payments are waiting", () => {
    const { unmount } = cell("customer", group());
    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("2 payments")).toBeInTheDocument();
    unmount();

    cell("customer", group({ paymentCount: 1 }));
    expect(screen.getByText("1 payment")).toBeInTheDocument();
  });

  it("shows how long they have waited from the oldest payment's date", () => {
    cell("oldest", group());

    expect(screen.getByText("Jul 1, 2026")).toBeInTheDocument();
  });

  it("shows the tax withheld that the certificate should cover", () => {
    cell("tax", group());

    expect(screen.getByText("₱120.00")).toBeInTheDocument();
  });

  it("points at the next step, in the market's word for the form", () => {
    cell("next", group());

    expect(screen.getByText("Record 2307")).toBeInTheDocument();
  });

  it("gives a phone the count, the oldest date and the form on one line", () => {
    expect(pendingSummaryLine("en-PH")(group())).toBe("2 payments · since Jul 1, 2026");
  });
});
