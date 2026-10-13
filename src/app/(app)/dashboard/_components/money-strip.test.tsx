import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MoneyRow } from "../_lib/money-rows";
import { MoneyStrip } from "./money-strip";

const names = { singular: "Billing statement", plural: "Billing statements" };
const row = (overrides: Partial<MoneyRow> = {}): MoneyRow => ({
  currency: "PHP",
  outstandingMinor: 500000,
  outstandingCount: 3,
  overdueMinor: 200000,
  overdueCount: 2,
  oldestOverdueDue: "2026-10-01",
  receivedMinor: 150000,
  paymentCount: 2,
  ...overrides,
});
const strip = (rows: MoneyRow[]) =>
  render(<MoneyStrip rows={rows} locale="en-PH" today="2026-10-12" windowDays={30} invoiceNames={names} />);

describe("MoneyStrip", () => {
  it("shows what is owed, what is late and what came in, each a link to where it lives", () => {
    strip([row()]);
    const money = screen.getByRole("region", { name: "Money" });

    const outstanding = within(money).getByRole("link", { name: /Outstanding/ });
    expect(outstanding).toHaveAttribute("href", "/invoices");
    expect(outstanding).toHaveTextContent("₱5,000.00");
    expect(outstanding).toHaveTextContent("3 billing statements");

    const overdue = within(money).getByRole("link", { name: /Overdue/ });
    expect(overdue).toHaveAttribute("href", "/invoices?status=overdue");
    expect(overdue).toHaveTextContent("₱2,000.00");

    const paid = within(money).getByRole("link", { name: /Paid in the last 30 days/ });
    expect(paid).toHaveAttribute("href", "/payments");
    expect(paid).toHaveTextContent("₱1,500.00");
    expect(paid).toHaveTextContent("2 payments");
  });

  it("says how late the oldest overdue bill is", () => {
    strip([row()]);

    expect(screen.getByRole("link", { name: /Overdue/ })).toHaveTextContent("2 billing statements · oldest 11 days late");
  });

  it("writes one of each in the singular", () => {
    strip([row({ outstandingCount: 1, overdueCount: 1, paymentCount: 1 })]);

    expect(screen.getByRole("link", { name: /Outstanding/ })).toHaveTextContent("1 billing statement");
    expect(screen.getByRole("link", { name: /Overdue/ })).toHaveTextContent("1 billing statement · oldest 11 days late");
    expect(screen.getByRole("link", { name: /Paid in/ })).toHaveTextContent("1 payment");
  });

  it("draws overdue in danger ink only when something is overdue", () => {
    const { unmount } = strip([row()]);
    expect(within(screen.getByRole("link", { name: /Overdue/ })).getByText("₱2,000.00")).toHaveClass("text-danger-strong");
    unmount();

    strip([row({ overdueMinor: 0, overdueCount: 0, oldestOverdueDue: null })]);
    const calm = screen.getByRole("link", { name: /Overdue/ });
    expect(within(calm).getByText("₱0.00")).not.toHaveClass("text-danger-strong");
    expect(calm).toHaveTextContent("Nothing overdue");
  });

  it("says so when no payment came in", () => {
    strip([row({ receivedMinor: 0, paymentCount: 0 })]);

    expect(screen.getByRole("link", { name: /Paid in/ })).toHaveTextContent("No payments yet");
  });

  it("gives each currency its own row and names the currency on every tile", () => {
    strip([row(), row({ currency: "USD", outstandingMinor: 9900, outstandingCount: 1, overdueMinor: 0, overdueCount: 0, oldestOverdueDue: null })]);

    expect(screen.getAllByRole("link", { name: /^Outstanding/ })).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Outstanding \(PHP\)/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Outstanding \(USD\)/ })).toHaveTextContent("$99.00");
  });

  it("leaves the label alone when there is only one currency", () => {
    strip([row()]);

    expect(screen.getByRole("link", { name: /Outstanding/ })).not.toHaveTextContent("(PHP)");
  });

  it("shows nothing at all when there is no money yet", () => {
    const { container } = strip([]);

    expect(container).toBeEmptyDOMElement();
  });
});
