import { describe, expect, it } from "vitest";
import { editedCertificate, formPayments, newCertificate, paymentsIn, startingQuarter } from "./form-data";

const payment = (paymentId: string, paidOn: string, currency = "PHP") => ({
  paymentId,
  receiptNumber: `OR-${paymentId}`,
  paidOn,
  invoiceId: "i1",
  invoiceNumber: "INV-000001",
  withheldMinor: 100,
  currency,
});

describe("formPayments", () => {
  it("keeps the business's currency and the fields the form shows", () => {
    expect(formPayments([payment("a", "2026-07-01"), payment("b", "2026-07-02", "USD")], "PHP")).toEqual([
      { paymentId: "a", receiptNumber: "OR-a", paidOn: "2026-07-01", invoiceNumber: "INV-000001", withheldMinor: 100 },
    ]);
  });
});

describe("startingQuarter", () => {
  const waiting = formPayments([payment("a", "2026-05-20"), payment("b", "2026-09-01")], "PHP");

  it("starts at the oldest payment still waiting", () => {
    expect(startingQuarter(waiting, "2026-10-13")).toEqual({ year: 2026, quarter: 2 });
  });

  it("starts at the quarter just finished when nothing waits", () => {
    expect(startingQuarter([], "2026-10-13")).toEqual({ year: 2026, quarter: 3 });
    expect(startingQuarter([], "2026-02-01")).toEqual({ year: 2025, quarter: 4 });
  });
});

describe("paymentsIn", () => {
  it("includes the first and last day of the quarter", () => {
    const all = formPayments([payment("a", "2026-06-30"), payment("b", "2026-07-01"), payment("c", "2026-09-30"), payment("d", "2026-10-01")], "PHP");
    expect(paymentsIn(all, 2026, 3).map((p) => p.paymentId)).toEqual(["b", "c"]);
  });
});

describe("newCertificate", () => {
  it("starts from the customer and ticks what waits in the first quarter", () => {
    const waiting = formPayments([payment("a", "2026-05-20"), payment("b", "2026-05-25"), payment("c", "2026-09-01")], "PHP");
    const customer = { id: "cust", displayName: "Juan Dela Cruz", company: "Dela Cruz Trading", taxId: "123-456-789-00000" };

    expect(newCertificate(customer, waiting, "2026-10-13")).toEqual({
      customerId: "cust",
      payorTin: "123-456-789-00000",
      payorName: "Dela Cruz Trading",
      payorAddress: "",
      year: "2026",
      quarter: "2",
      receivedOn: "2026-10-13",
      notes: "",
      lines: [{ atcCode: "", description: "", rate: "", month1: "", month2: "", month3: "", taxWithheld: "" }],
      paymentIds: ["a", "b"],
    });
  });

  it("falls back to the display name and an empty TIN", () => {
    const made = newCertificate({ id: "cust", displayName: "Juan Dela Cruz", company: null, taxId: null }, [], "2026-10-13");
    expect(made.payorName).toBe("Juan Dela Cruz");
    expect(made.payorTin).toBe("");
  });
});

describe("editedCertificate", () => {
  const detail = {
    customerId: "cust",
    payorTin: "123-456-789-00000",
    payorName: "Dela Cruz Trading",
    payorAddress: "123 Rizal Street",
    periodFrom: "2026-07-01",
    receivedOn: "2026-10-05",
    notes: null,
    lines: [
      { atcCode: "WI160", description: "Professional fees", rateBps: 200, monthMinor: [100_000, 0, 125_050] as [number, number, number], taxWithheldMinor: 4_501 },
      { atcCode: "WC100", description: null, rateBps: 150, monthMinor: [0, 5_000, 0] as [number, number, number], taxWithheldMinor: 75 },
    ],
    payments: [{ paymentId: "p1" }, { paymentId: "p2" }],
  };

  it("turns a saved certificate back into what the form types", () => {
    expect(editedCertificate(detail, "PHP", "en-PH")).toEqual({
      customerId: "cust",
      payorTin: "123-456-789-00000",
      payorName: "Dela Cruz Trading",
      payorAddress: "123 Rizal Street",
      year: "2026",
      quarter: "3",
      receivedOn: "2026-10-05",
      notes: "",
      lines: [
        { atcCode: "WI160", description: "Professional fees", rate: "2", month1: "1,000.00", month2: "", month3: "1,250.50", taxWithheld: "45.01" },
        { atcCode: "WC100", description: "", rate: "1.5", month1: "", month2: "50.00", month3: "", taxWithheld: "0.75" },
      ],
      paymentIds: ["p1", "p2"],
    });
  });
});
