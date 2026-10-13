import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SummaryStrip } from "@/components/summary-strip";
import { paymentStrip } from "./summary";

const received = (currency: string, receivedMinor: number, paymentCount: number) => ({ currency, receivedMinor, paymentCount });
const windows = (over: Partial<Parameters<typeof paymentStrip>[0]["windows"]> = {}) => ({
  today: [received("PHP", 150_000, 2)],
  week: [received("PHP", 400_000, 5)],
  month: [received("PHP", 1_500_000, 35)],
  ...over,
});
const strip = (over?: Parameters<typeof windows>[0]) =>
  render(<SummaryStrip label="Payment summary" rows={paymentStrip({ windows: windows(over), locale: "en-PH", currency: "PHP" })} />);

describe("paymentStrip", () => {
  it("shows what came in today, in the last 7 days and in the last 30, with how many payments", () => {
    strip();
    const items = screen.getAllByRole("listitem");

    expect(items[0]).toHaveTextContent("Today");
    expect(items[0]).toHaveTextContent("₱1,500.00");
    expect(items[0]).toHaveTextContent("2 payments");
    expect(items[1]).toHaveTextContent("Last 7 days");
    expect(items[1]).toHaveTextContent("₱4,000.00");
    expect(items[1]).toHaveTextContent("5 payments");
    expect(items[2]).toHaveTextContent("Last 30 days");
    expect(items[2]).toHaveTextContent("₱15,000.00");
    expect(items[2]).toHaveTextContent("35 payments");
  });

  it("is plain figures: the list underneath is the payments themselves, so nothing links", () => {
    strip();

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("says so when nothing came in, and writes one payment in the singular", () => {
    strip({ today: [], week: [received("PHP", 5_000, 1)] });
    const items = screen.getAllByRole("listitem");

    expect(items[0]).toHaveTextContent("₱0.00");
    expect(items[0]).toHaveTextContent("No payments");
    expect(items[1]).toHaveTextContent("1 payment");
    expect(items[1]).not.toHaveTextContent("1 payments");
  });

  it("stacks a row for each currency and names the currency", () => {
    strip({ month: [received("PHP", 1_500_000, 35), received("USD", 9_900, 1)] });

    expect(screen.getAllByRole("list")).toHaveLength(2);
    expect(screen.getByText("Last 30 days (USD)")).toBeInTheDocument();
    expect(screen.getByText("$99.00")).toBeInTheDocument();
  });

  it("shows zeros in the business's own currency when nothing has come in", () => {
    strip({ today: [], week: [], month: [] });
    const items = screen.getAllByRole("listitem");

    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item).toHaveTextContent("₱0.00");
      expect(item).toHaveTextContent("No payments");
    }
  });

  it("lets a phone leave out the middle figure", () => {
    strip();

    expect(screen.getAllByRole("listitem")[1]).toHaveClass("max-sm:hidden");
  });
});
