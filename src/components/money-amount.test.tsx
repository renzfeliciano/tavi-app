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
});
