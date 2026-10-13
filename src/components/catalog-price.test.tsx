import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogPrice } from "./catalog-price";

describe("CatalogPrice", () => {
  it("shows the price and what it is per", () => {
    render(<CatalogPrice priceMinor={150_000} currency="PHP" unitLabel="hour" />);
    expect(screen.getByText("₱1,500.00")).toHaveAttribute("value", "1500.00 PHP");
    expect(screen.getByText("per hour")).toBeInTheDocument();
  });

  it("says so when the price isn't known yet, instead of showing a made-up amount", () => {
    const { container } = render(<CatalogPrice priceMinor={null} currency="PHP" unitLabel="hour" />);
    expect(screen.getByText("No price yet")).toBeInTheDocument();
    expect(screen.getByText("per hour")).toBeInTheDocument();
    expect(container.querySelector("data")).toBeNull();
    expect(container).not.toHaveTextContent("₱");
  });

  it("shows a free item as free, not as unpriced", () => {
    render(<CatalogPrice priceMinor={0} currency="PHP" unitLabel="visit" />);
    expect(screen.getByText("₱0.00")).toBeInTheDocument();
    expect(screen.queryByText("No price yet")).toBeNull();
  });
});
