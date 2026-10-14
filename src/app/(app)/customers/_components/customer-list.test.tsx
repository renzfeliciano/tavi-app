import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import type { CustomerRow } from "../_lib/figures";
import { customerColumns, customerSummary } from "./customer-list";

const customer = (over: Partial<CustomerRow> = {}): CustomerRow => ({
  id: "c1",
  displayName: "Juan Dela Cruz",
  company: null,
  email: "juan@example.com",
  phone: null,
  city: "Pasig",
  category: null,
  archivedAt: null,
  owing: [],
  activity: null,
  ...over,
});

const columns = customerColumns("en-PH", MARKETS.PH);
const cell = (id: string, row: CustomerRow) => {
  const column = columns.find((c) => c.id === id);
  if (!column) throw new Error(`no ${id} column`);
  return render(<>{column.cell(row)}</>);
};

describe("customer list columns", () => {
  it("shows who the customer is, what they owe and when something last happened, in that order of importance", () => {
    expect(columns.map((c) => c.id)).toEqual(["customer", "contact", "activity", "balance"]);
    expect(columns.map((c) => c.header)).toEqual(["Customer", "Contact", "Last activity", "Balance"]);
  });

  it("right-aligns the balance and keeps it on a phone, where the amount sits opposite the name", () => {
    const balance = columns.find((c) => c.id === "balance");

    expect(balance?.align).toBe("end");
    expect(balance?.phone).toBe("end");
  });

  it("drops the columns that need room before the balance does", () => {
    const hidden = Object.fromEntries(columns.map((c) => [c.id, c.hideBelow ?? null]));

    expect(hidden).toEqual({ customer: null, contact: "md", activity: "lg", balance: null });
  });

  describe("balance", () => {
    it("says nothing is owed for a customer who has paid up or has no statement yet", () => {
      cell("balance", customer());

      expect(screen.getByText("Nothing owed")).toBeInTheDocument();
    });

    it("shows the amount owed, and says it isn't due yet when none of it is late", () => {
      cell("balance", customer({ owing: [{ currency: "PHP", owedMinor: 250_000, overdueMinor: 0 }] }));

      expect(screen.getByText("₱2,500.00")).toBeInTheDocument();
      expect(screen.getByText("Not due yet")).toBeInTheDocument();
      expect(screen.queryByText(/overdue/i)).toBeNull();
    });

    it("shows how much of it is overdue, in danger ink", () => {
      cell("balance", customer({ owing: [{ currency: "PHP", owedMinor: 250_000, overdueMinor: 150_000 }] }));

      const line = screen.getByText("₱1,500.00").closest("span");
      expect(line).toHaveTextContent("₱1,500.00 overdue");
      expect(line).toHaveClass("text-danger-strong");
      expect(screen.queryByText("Not due yet")).toBeNull();
    });

    it("keeps a customer's currencies apart, never adding one to another", () => {
      cell(
        "balance",
        customer({
          owing: [
            { currency: "PHP", owedMinor: 250_000, overdueMinor: 0 },
            { currency: "USD", owedMinor: 7_000, overdueMinor: 0 },
          ],
        }),
      );

      expect(screen.getByText("₱2,500.00")).toBeInTheDocument();
      expect(screen.getByText("$70.00")).toBeInTheDocument();
    });
  });

  describe("last activity", () => {
    it("says when, and on which kind of document, in the market's own words", () => {
      cell("activity", customer({ activity: { on: "2026-10-13", when: "Yesterday", kind: "invoice" } }));

      expect(screen.getByText("Yesterday")).toBeInTheDocument();
      expect(screen.getByText("Billing statement")).toBeInTheDocument();
    });

    it("names a quotation as one", () => {
      cell("activity", customer({ activity: { on: "2026-10-13", when: "Yesterday", kind: "quote" } }));

      expect(screen.getByText("Quotation")).toBeInTheDocument();
    });

    it("says so when nothing has happened with them yet", () => {
      cell("activity", customer());

      expect(screen.getByText("No activity yet")).toBeInTheDocument();
    });
  });

  describe("on a phone", () => {
    it("puts the contact and city under the name, since the columns that carry them are left out", () => {
      expect(customerSummary(customer())).toBe("juan@example.com · Pasig");
      expect(customerSummary(customer({ email: null, phone: "0917 555 0100", city: null }))).toBe("0917 555 0100");
      expect(customerSummary(customer({ email: null, phone: null, city: null }))).toBe("No contact details");
    });
  });
});
