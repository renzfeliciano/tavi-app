import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaymentsActions } from "./payments-actions";

describe("PaymentsActions", () => {
  it("links to Withholding", () => {
    render(<PaymentsActions certificate="2307" />);
    expect(screen.getByRole("link", { name: "Withholding (2307)" })).toHaveAttribute("href", "/payments/withholding");
  });

  it("shows no link where the market has no withheld tax", () => {
    render(<PaymentsActions certificate={null} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
