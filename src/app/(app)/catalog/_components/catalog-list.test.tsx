import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CatalogRow } from "../_lib/usage";
import { catalogColumns } from "./catalog-list";

const row = (over: Partial<CatalogRow> = {}): CatalogRow => ({
  kind: "product",
  id: "p1",
  name: "Air filter",
  description: "Washable, fits split types",
  sku: "AF-100",
  unitLabel: "pc",
  unitPriceMinor: 80_000,
  currency: "PHP",
  taxRateId: null,
  archivedAt: null,
  use: null,
  ...over,
});

const products = catalogColumns("product", "en-PH");
const services = catalogColumns("service", "en-PH");
const cell = (columns: typeof products, id: string, item: CatalogRow) => {
  const column = columns.find((c) => c.id === id);
  if (!column) throw new Error(`no ${id} column`);
  return render(<>{column.cell(item)}</>);
};

describe("catalog list columns", () => {
  it("shows what it is, its SKU if a product, when it was last used and what it costs", () => {
    expect(products.map((c) => c.id)).toEqual(["item", "sku", "used", "price"]);
    expect(products.map((c) => c.header)).toEqual(["Product", "SKU", "Last used", "Price"]);
    expect(services.map((c) => c.id)).toEqual(["item", "used", "price"]);
    expect(services.map((c) => c.header)).toEqual(["Service", "Last used", "Price"]);
  });

  it("drops the columns that need room before the name and the price do", () => {
    const hidden = Object.fromEntries(products.map((c) => [c.id, c.hideBelow ?? null]));

    expect(hidden).toEqual({ item: null, sku: "md", used: "lg", price: null });
  });

  it("keeps the price on the right, opposite the name on a phone", () => {
    const price = products.find((c) => c.id === "price");

    expect(price?.align).toBe("end");
    expect(price?.phone).toBe("end");
  });

  describe("last used", () => {
    it("says when, and how many times", () => {
      cell(products, "used", row({ use: { count: 12, when: "Yesterday" } }));

      expect(screen.getByText("Yesterday")).toBeInTheDocument();
      expect(screen.getByText("Used 12 times")).toBeInTheDocument();
    });

    it("says once for one", () => {
      cell(products, "used", row({ use: { count: 1, when: "Today" } }));

      expect(screen.getByText("Used once")).toBeInTheDocument();
    });

    it("says so when it has never been on a sent document", () => {
      cell(products, "used", row());

      expect(screen.getByText("Never used")).toBeInTheDocument();
    });
  });

  describe("the item itself", () => {
    it("shows the name and description, and on a phone also the SKU, whose own column is left out there", () => {
      cell(products, "item", row());

      expect(screen.getByText("Air filter")).toBeInTheDocument();
      expect(screen.getByText(/Washable, fits split types/)).toBeInTheDocument();
      const sku = screen.getByText("AF-100");
      // Only a phone needs it here; from `md` its own column shows it.
      expect(sku).toHaveClass("md:hidden", "font-mono");
    });

    it("shows the SKU on a phone even for a product with no description", () => {
      cell(products, "item", row({ description: null }));

      expect(screen.getByText("AF-100")).toHaveClass("md:hidden");
    });

    it("has nothing under the name for a service with neither", () => {
      cell(services, "item", row({ kind: "service", description: null, sku: null }));

      expect(screen.getByText("Air filter")).toBeInTheDocument();
      expect(screen.queryByText(/\S/, { selector: "span.text-muted-foreground" })).toBeNull();
    });
  });

  it("keeps saying what a price is per", () => {
    cell(products, "price", row());

    expect(screen.getByText("per pc")).toBeInTheDocument();
    expect(screen.getByText("₱800.00")).toBeInTheDocument();
  });

  it("keeps saying that no price is set yet, which is not the same as free", () => {
    cell(products, "price", row({ unitPriceMinor: null }));

    expect(screen.getByText("No price yet")).toBeInTheDocument();
    expect(screen.getByText("per pc")).toBeInTheDocument();
  });
});
