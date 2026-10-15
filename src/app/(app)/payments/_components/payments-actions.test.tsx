import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaymentsActions } from "./payments-actions";

describe("PaymentsActions", () => {
  it("links to Receipts and to Withholding", () => {
    render(<PaymentsActions certificate="2307" />);
    expect(screen.getByRole("link", { name: "Receipts" })).toHaveAttribute("href", "/receipts");
    expect(screen.getByRole("link", { name: "Withholding (2307)" })).toHaveAttribute("href", "/payments/withholding");
  });

  it("links only to Receipts where the market has no withheld tax", () => {
    render(<PaymentsActions certificate={null} />);
    expect(screen.getByRole("link", { name: "Receipts" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Withholding/ })).toBeNull();
  });
});
