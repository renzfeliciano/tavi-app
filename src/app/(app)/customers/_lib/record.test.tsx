import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import { SummaryStrip } from "@/components/summary-strip";
import type { CustomerMoney } from "@/modules/invoices";
import { customerStrip } from "./record";

const money = (over: Partial<CustomerMoney> = {}): CustomerMoney => ({
  customerId: "juan",
  currency: "PHP",
  billedMinor: 600_000,
  paidMinor: 350_000,
  owedMinor: 250_000,
  overdueMinor: 0,
  count: 3,
  ...over,
});
const strip = (rows: CustomerMoney[]) =>
  render(<SummaryStrip label="Customer summary" rows={customerStrip({ money: rows, locale: "en-PH", currency: "PHP", market: MARKETS.PH })} />);

describe("customerStrip", () => {
  it("shows what they owe, what they have been billed and what they have paid", () => {
    strip([money()]);
    const items = screen.getAllByRole("listitem");

    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Owed");
    expect(items[0]).toHaveTextContent("₱2,500.00");
    expect(items[1]).toHaveTextContent("Billed");
    expect(items[1]).toHaveTextContent("₱6,000.00");
    expect(items[1]).toHaveTextContent("3 billing statements");
    expect(items[2]).toHaveTextContent("Paid");
    expect(items[2]).toHaveTextContent("₱3,500.00");
    expect(items[2]).toHaveTextContent("58% of billed");
  });

  it("says nothing is late while some is owed but not due, and names the late part in danger ink when there is", () => {
    const { unmount } = strip([money()]);
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Not due yet");
    unmount();

    strip([money({ overdueMinor: 150_000 })]);
    const owed = screen.getAllByRole("listitem")[0];
    expect(owed).toHaveTextContent("₱1,500.00 overdue");
    expect(screen.getByText("₱2,500.00").closest("span")).toHaveClass("text-danger-strong");
  });

  it("says nothing is owed for a customer who has paid up", () => {
    strip([money({ owedMinor: 0, paidMinor: 600_000 })]);
    const items = screen.getAllByRole("listitem");

    expect(items[0]).toHaveTextContent("Nothing owed");
    expect(items[2]).toHaveTextContent("100% of billed");
  });

  it("never says all of it is paid while some is still owed, nor that none is when something has been paid", () => {
    const { unmount } = strip([money({ billedMinor: 200_000, paidMinor: 199_600, owedMinor: 400 })]);
    expect(screen.getAllByRole("listitem")[2]).toHaveTextContent("99% of billed");
    unmount();

    strip([money({ billedMinor: 100_000, paidMinor: 100, owedMinor: 99_900 })]);
    expect(screen.getAllByRole("listitem")[2]).toHaveTextContent("Under 1% of billed");
  });

  it("shows zeros in the business's own currency before the first statement, so the strip is there from the start", () => {
    strip([]);
    const items = screen.getAllByRole("listitem");

    expect(items[0]).toHaveTextContent("₱0.00");
    expect(items[0]).toHaveTextContent("Nothing owed");
    expect(items[1]).toHaveTextContent("No billing statements yet");
    expect(items[2]).toHaveTextContent("Nothing paid yet");
  });

  it("writes one statement in the singular", () => {
    strip([money({ count: 1 })]);

    expect(screen.getAllByRole("listitem")[1]).toHaveTextContent("1 billing statement");
    expect(screen.getAllByRole("listitem")[1]).not.toHaveTextContent("1 billing statements");
  });

  it("gives each currency its own row, named, and never adds one to another", () => {
    strip([money(), money({ currency: "USD", billedMinor: 10_000, paidMinor: 0, owedMinor: 10_000, count: 1 })]);

    expect(screen.getAllByRole("list")).toHaveLength(2);
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Owed (PHP)");
    expect(screen.getAllByRole("listitem")[3]).toHaveTextContent("Owed (USD)");
    expect(screen.getAllByRole("listitem")[3]).toHaveTextContent("$100.00");
  });

  it("keeps what they owe and were billed on a phone, and leaves out what they paid", () => {
    const [row] = customerStrip({ money: [money()], locale: "en-PH", currency: "PHP", market: MARKETS.PH });

    expect(row?.figures.map((f) => [f.key, f.phone])).toEqual([
      ["owed", undefined],
      ["billed", undefined],
      ["paid", false],
    ]);
  });

  it("has nothing that links: the lists under it are the detail", () => {
    strip([money()]);

    expect(screen.queryByRole("link")).toBeNull();
  });
});
