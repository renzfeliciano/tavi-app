import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaxRatesManager } from "./tax-rates-manager";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("./actions", () => ({
  archiveTaxRateAction: vi.fn(),
  makeDefaultTaxRate: vi.fn(),
  restoreTaxRateAction: vi.fn(),
  saveTaxRate: vi.fn(),
}));

describe("the Add a tax dialog", () => {
  it("shows the market's own tax as the example while its fields are empty", () => {
    render(<TaxRatesManager rates={[]} suggestions={[{ name: "VAT", rate: "12%", rateInput: "12" }]} editable />);

    fireEvent.click(screen.getByRole("button", { name: "Add another tax" }));

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAttribute("placeholder", "e.g. VAT");
    expect(screen.getByRole("textbox", { name: "Rate" })).toHaveAttribute("placeholder", "e.g. 12");
  });

  it("still shows an example when the market has nothing left to suggest", () => {
    render(<TaxRatesManager rates={[]} suggestions={[]} editable />);

    fireEvent.click(screen.getByRole("button", { name: "Add a tax" }));

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAttribute("placeholder", "e.g. Sales tax");
    expect(screen.getByRole("textbox", { name: "Rate" })).toHaveAttribute("placeholder", "e.g. 5");
  });
});
