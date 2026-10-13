import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CatalogItemForm, type CatalogItemFormCopy } from "./catalog-item-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("../actions", () => ({ saveCatalogItem: vi.fn() }));

const copy: CatalogItemFormCopy = {
  units: ["hour", "pc"],
  pricePlaceholder: "e.g. 1,250.50",
  nameExamples: { service: "Aircon deep cleaning", product: "Aircon filter" },
  taxModeHint: "Your prices include tax.",
  currencies: [{ code: "PHP", label: "PHP · Philippine Peso" }],
  taxRates: [],
};

const values = { name: "", description: "", sku: "", unitLabel: "hour", unitPrice: "", currency: "PHP", taxRateId: "" };

describe("CatalogItemForm price", () => {
  it("marks the price optional and says what leaving it blank means", () => {
    render(<CatalogItemForm kind="service" initialValues={values} copy={copy} />);

    const price = screen.getByRole("textbox", { name: /Price per unit/ });
    expect(screen.getByText("Price per unit").closest("label")).toHaveTextContent("(optional)");
    expect(price).not.toBeRequired();
    expect(price).toHaveAccessibleDescription(/Leave it blank if you don't know it yet/);
  });

  it("shows a saved item that has no price with an empty price field", () => {
    render(<CatalogItemForm kind="product" itemId="a" initialValues={{ ...values, name: "Custom panel" }} copy={copy} />);

    expect(screen.getByRole("textbox", { name: /Price per unit/ })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /Price per unit/ })).toHaveAttribute("placeholder", "e.g. 1,250.50");
  });
});

describe("CatalogItemForm examples", () => {
  it("shows a service example on a service's empty fields", () => {
    render(<CatalogItemForm kind="service" initialValues={values} copy={copy} />);

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAttribute("placeholder", "e.g. Aircon deep cleaning");
    expect(screen.getByRole("textbox", { name: /^Description/ })).toHaveAttribute("placeholder", expect.stringMatching(/^e\.g\. /));
  });

  it("shows a product example on a product's, with a code for the SKU", () => {
    render(<CatalogItemForm kind="product" initialValues={{ ...values, unitLabel: "pc" }} copy={copy} />);

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAttribute("placeholder", "e.g. Aircon filter");
    expect(screen.getByRole("textbox", { name: /^SKU/ })).toHaveAttribute("placeholder", expect.stringMatching(/^e\.g\. [A-Z0-9-]+$/));
  });
});
