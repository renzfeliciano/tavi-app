import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SupplierSummary } from "@/modules/purchasing";
import { supplierColumns, supplierSummary } from "./supplier-list";

const supplier = (over: Partial<SupplierSummary> = {}): SupplierSummary => ({
  id: "s1",
  displayName: "Santos Hardware",
  contactName: "Rosa Reyes",
  email: "orders@santos.example",
  phone: null,
  city: "Quezon City",
  archivedAt: null,
  ...over,
});

const columns = supplierColumns();
const cell = (id: string, row: SupplierSummary) => {
  const column = columns.find((c) => c.id === id);
  if (!column) throw new Error(`no ${id} column`);
  return render(<>{column.cell(row)}</>);
};

describe("supplier list columns", () => {
  it("shows who the supplier is, how to reach them and where they are", () => {
    expect(columns.map((c) => c.header)).toEqual(["Supplier", "Contact", "City"]);
  });

  it("drops the columns that need room, never the name", () => {
    const hidden = Object.fromEntries(columns.map((c) => [c.id, c.hideBelow ?? null]));
    expect(hidden).toEqual({ supplier: null, contact: "md", city: "lg" });
  });

  it("names the supplier with the person to ask for under it", () => {
    cell("supplier", supplier());
    expect(screen.getByText("Santos Hardware")).toBeInTheDocument();
    expect(screen.getByText("Rosa Reyes")).toBeInTheDocument();
  });

  it("shows the email first and the phone under it, and says so when there is neither", () => {
    const { unmount } = cell("contact", supplier({ phone: "0917 555 0111" }));
    expect(screen.getByText("orders@santos.example")).toBeInTheDocument();
    expect(screen.getByText("0917 555 0111")).toBeInTheDocument();
    unmount();
    cell("contact", supplier({ email: null }));
    expect(screen.getByText("No contact details")).toBeInTheDocument();
  });

  it("puts the contact and city under the name on a phone", () => {
    expect(supplierSummary(supplier())).toBe("orders@santos.example · Quezon City");
    expect(supplierSummary(supplier({ email: null, phone: "0917 555 0111", city: null }))).toBe("0917 555 0111");
    expect(supplierSummary(supplier({ email: null, phone: null, city: null }))).toBe("No contact details");
  });
});
