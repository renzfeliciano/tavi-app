import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaidProgress, paidShare } from "./paid-progress";

describe("paidShare", () => {
  it("is the part of the total that has been paid, from 0 to 100", () => {
    expect(paidShare(0, 300000)).toBe(0);
    expect(paidShare(100000, 300000)).toBe(33);
    expect(paidShare(300000, 300000)).toBe(100);
  });

  it("never reads as paid before it is, and never goes past the ends", () => {
    expect(paidShare(299999, 300000)).toBe(99);
    expect(paidShare(1, 300000)).toBe(1);
    expect(paidShare(400000, 300000)).toBe(100);
    expect(paidShare(-5, 300000)).toBe(0);
  });

  it("has nothing to show for a bill of nothing", () => {
    expect(paidShare(0, 0)).toBe(0);
  });
});

describe("PaidProgress", () => {
  it("says how much of the bill has been paid, in words and in a bar", () => {
    const { container } = render(<PaidProgress paidMinor={100000} totalMinor={300000} currency="PHP" locale="en-PH" />);

    expect(screen.getByText("₱1,000.00")).toBeInTheDocument();
    expect(screen.getByText(/of/)).toHaveTextContent("of ₱3,000.00");
    // The words carry the meaning; the bar only draws it.
    const bar = container.querySelector('[data-slot="paid-progress-bar"]') as HTMLElement;
    expect(bar).toHaveAttribute("aria-hidden", "true");
    expect(bar.firstElementChild).toHaveStyle({ width: "33%" });
    expect(bar.firstElementChild).toHaveClass("bg-success");
  });

  it("shows an empty bar for a bill nobody has paid yet", () => {
    const { container } = render(<PaidProgress paidMinor={0} totalMinor={300000} currency="PHP" locale="en-PH" />);

    expect(container.querySelector('[data-slot="paid-progress-bar"]')?.firstElementChild).toHaveStyle({ width: "0%" });
  });
});
