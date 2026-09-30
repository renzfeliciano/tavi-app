import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MoneyAmount } from "./money-amount";

describe("MoneyAmount", () => {
  it("renders formatted pesos from minor units", () => {
    render(<MoneyAmount amountMinor={840_000} currency="PHP" />);
    expect(screen.getByText("₱8,400.00")).toBeInTheDocument();
  });

  it("carries the exact machine-readable value", () => {
    render(<MoneyAmount amountMinor={12_345} currency="PHP" />);
    expect(screen.getByText("₱123.45")).toHaveAttribute("value", "123.45 PHP");
  });

  it("uses tabular figures and never wraps", () => {
    render(<MoneyAmount amountMinor={100} currency="PHP" />);
    expect(screen.getByText("₱1.00")).toHaveClass("tabular-nums", "whitespace-nowrap");
  });

  it("formats in the business's locale when given", () => {
    const { container } = render(<MoneyAmount amountMinor={125_050} currency="EUR" locale="de-DE" />);
    const amount = container.querySelector("data");
    expect(amount).toHaveTextContent(/^1\.250,50\s€$/);
    expect(amount).toHaveAttribute("value", "1250.50 EUR");
  });
});
