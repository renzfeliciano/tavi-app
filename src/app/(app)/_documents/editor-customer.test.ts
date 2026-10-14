import { describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import type { Customer } from "@/modules/customers";
import { toEditorCustomer } from "./editor-customer";

const customer = (over: Partial<Customer> = {}): Customer => ({
  id: "c1",
  displayName: "Juan Dela Cruz",
  company: "Dela Cruz Trading",
  email: "juan@example.com",
  phone: "0917 555 0100",
  addressLine1: "12 Rizal St",
  addressLine2: null,
  city: "Pasig",
  region: "Metro Manila",
  postalCode: "1600",
  taxId: "123-456-789-000",
  currency: "USD",
  category: null,
  notes: "Pays late",
  archivedAt: null,
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  ...over,
});

describe("toEditorCustomer", () => {
  it("is the customer as a document shows them: name, company, address, contact and tax number", () => {
    const editor = toEditorCustomer(customer(), MARKETS.PH);

    expect(editor.id).toBe("c1");
    expect(editor.email).toBe("juan@example.com");
    expect(editor.party.name).toBe("Juan Dela Cruz");
    expect(editor.party.subtitle).toBe("Dela Cruz Trading");
    expect(editor.party.addressLines.join(" ")).toContain("Pasig");
    expect(editor.party.contactLines).toEqual(["juan@example.com", "0917 555 0100"]);
    expect(editor.party.taxId).toEqual({ label: MARKETS.PH.taxId.label, value: "123-456-789-000" });
  });

  it("brings their preferred currency along, so a new document can bill in it", () => {
    expect(toEditorCustomer(customer(), MARKETS.PH).currency).toBe("USD");
    expect(toEditorCustomer(customer({ currency: null }), MARKETS.PH).currency).toBeNull();
  });

  it("leaves out contact lines and a tax number they don't have", () => {
    const editor = toEditorCustomer(customer({ email: null, phone: null, taxId: null }), MARKETS.PH);

    expect(editor.party.contactLines).toEqual([]);
    expect(editor.party.taxId).toBeNull();
  });
});
