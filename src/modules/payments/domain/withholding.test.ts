import { describe, expect, it } from "vitest";
import {
  defaultTaxWithheld,
  LINK_MESSAGES,
  monthNamesOfQuarter,
  parseCertificateInput,
  quarterBounds,
  quarterOf,
  type RawCertificate,
  reconcile,
  withholdingStatus,
} from "./withholding";

const CUSTOMER = "5b7a1a0e-3c1d-4a53-9a55-0c9f2f0d1e11";
const PAYMENT = "9d3c6a52-86a0-4e0e-8f43-62c6a1f4b222";
const OPTIONS = { currency: "PHP", locale: "en-PH", today: "2026-10-13" };

const valid = (overrides: Partial<RawCertificate> = {}): RawCertificate => ({
  customerId: CUSTOMER,
  payorTin: "123 456 789 000",
  payorName: "Dela Cruz Trading",
  payorAddress: "12 Sampaguita St, Quezon City",
  year: "2026",
  quarter: "3",
  receivedOn: "2026-10-05",
  notes: "",
  lines: [{ atcCode: "wi160", description: "Services", rate: "2", month1: "1,200.50", month2: "", month3: "500", taxWithheld: "34.01" }],
  paymentIds: [PAYMENT],
  ...overrides,
});

const errorsOf = (raw: RawCertificate) => {
  const result = parseCertificateInput(raw, OPTIONS);
  if (result.ok) throw new Error("expected errors");
  return result.errors;
};
const withLine = (line: Partial<RawCertificate["lines"][number]>) => valid({ lines: [{ ...valid().lines[0]!, ...line }] });

describe("quarterBounds and quarterOf", () => {
  it("gives the first and last day of each calendar quarter", () => {
    expect(quarterBounds(2026, 1)).toEqual({ from: "2026-01-01", to: "2026-03-31" });
    expect(quarterBounds(2026, 2)).toEqual({ from: "2026-04-01", to: "2026-06-30" });
    expect(quarterBounds(2026, 3)).toEqual({ from: "2026-07-01", to: "2026-09-30" });
    expect(quarterBounds(2026, 4)).toEqual({ from: "2026-10-01", to: "2026-12-31" });
  });

  it("finds the quarter of a date, across the year end", () => {
    expect(quarterOf("2026-12-31")).toEqual({ year: 2026, quarter: 4 });
    expect(quarterOf("2027-01-01")).toEqual({ year: 2027, quarter: 1 });
    expect(quarterOf("2026-07-01")).toEqual({ year: 2026, quarter: 3 });
  });

  it("names the three months of a quarter in the locale", () => {
    expect(monthNamesOfQuarter(3, "en-PH")).toEqual(["July", "August", "September"]);
    expect(monthNamesOfQuarter(1, "en-PH")).toEqual(["January", "February", "March"]);
  });
});

describe("defaultTaxWithheld", () => {
  it("is the rate of the total, rounded half up, in whole minor units", () => {
    expect(defaultTaxWithheld(100_000, 200)).toBe(2000);
    expect(defaultTaxWithheld(25, 200)).toBe(1); // 0.5 centavo rounds up
    expect(defaultTaxWithheld(24, 200)).toBe(0);
    expect(defaultTaxWithheld(0, 200)).toBe(0);
  });

  it("stays exact for the largest amounts the app accepts", () => {
    expect(defaultTaxWithheld(99_999_999_999_999, 10_000)).toBe(99_999_999_999_999);
    expect(defaultTaxWithheld(99_999_999_999_999, 1)).toBe(10_000_000_000); // 9,999,999,999.9999 rounds up
  });
});

describe("withholdingStatus and reconcile", () => {
  it("is none without tax withheld, pending until a certificate is linked, then received", () => {
    expect(withholdingStatus(0, false)).toBe("none");
    expect(withholdingStatus(0, true)).toBe("none");
    expect(withholdingStatus(5000, false)).toBe("pending");
    expect(withholdingStatus(5000, true)).toBe("received");
  });

  it("compares the certificate with the linked payments, certificate minus linked", () => {
    expect(reconcile(2000, 2000)).toEqual({ matches: true, differenceMinor: 0 });
    expect(reconcile(2000, 1500)).toEqual({ matches: false, differenceMinor: 500 });
    expect(reconcile(1000, 1500)).toEqual({ matches: false, differenceMinor: -500 });
    expect(reconcile(2000, 0)).toEqual({ matches: false, differenceMinor: 2000 });
  });
});

describe("LINK_MESSAGES", () => {
  it("has one message per link rule", () => {
    expect(Object.keys(LINK_MESSAGES).sort()).toEqual(
      ["alreadyLinked", "currency", "noWithheld", "notFound", "otherCustomer", "outsidePeriod", "voided"].sort(),
    );
    expect(LINK_MESSAGES.alreadyLinked).toBe("That payment is already on another 2307.");
  });
});

describe("parseCertificateInput", () => {
  it("reads a valid certificate into minor units and the quarter's dates", () => {
    const result = parseCertificateInput(valid(), OPTIONS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      customerId: CUSTOMER,
      payorTin: "123 456 789 000",
      payorName: "Dela Cruz Trading",
      payorAddress: "12 Sampaguita St, Quezon City",
      periodFrom: "2026-07-01",
      periodTo: "2026-09-30",
      receivedOn: "2026-10-05",
      notes: null,
      lines: [
        {
          position: 1,
          atcCode: "WI160",
          description: "Services",
          rateBps: 200,
          monthMinor: [120_050, 0, 50_000],
          totalMinor: 170_050,
          taxWithheldMinor: 3401,
        },
      ],
      paymentIds: [PAYMENT],
    });
  });

  it("accepts a TIN with spaces or dashes and a decimal rate, and drops repeated payment ids", () => {
    const result = parseCertificateInput(
      { ...withLine({ rate: "2.5" }), payorTin: "123-456-789-000", paymentIds: [PAYMENT, PAYMENT] },
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.payorTin).toBe("123-456-789-000");
    expect(result.value.lines[0]?.rateBps).toBe(250);
    expect(result.value.paymentIds).toEqual([PAYMENT]);
  });

  it("accepts a spaced thousands amount, as the payment form does", () => {
    const result = parseCertificateInput(withLine({ month1: "1 200", month3: "", taxWithheld: "24" }), OPTIONS);
    expect(result.ok && result.value.lines[0]?.monthMinor).toEqual([120_000, 0, 0]);
  });

  it("refuses a TIN with fewer than 9 digits or with letters", () => {
    expect(errorsOf(valid({ payorTin: "12345678" })).payorTin).toBeTruthy();
    expect(errorsOf(valid({ payorTin: "123 456 78X 000" })).payorTin).toBeTruthy();
    expect(errorsOf(valid({ payorTin: "" })).payorTin).toBeTruthy();
  });

  it("requires the payor's name and a customer", () => {
    expect(errorsOf(valid({ payorName: "  " })).payorName).toBeTruthy();
    expect(errorsOf(valid({ customerId: "nope" })).customerId).toBeTruthy();
  });

  it("refuses a missing or impossible quarter", () => {
    expect(errorsOf(valid({ quarter: "5" })).quarter).toBeTruthy();
    expect(errorsOf(valid({ quarter: "" })).quarter).toBeTruthy();
    expect(errorsOf(valid({ year: "26" })).quarter).toBeTruthy();
  });

  it("refuses a received date that is not real or is in the future", () => {
    expect(errorsOf(valid({ receivedOn: "2026-02-30" })).receivedOn).toBeTruthy();
    expect(errorsOf(valid({ receivedOn: "2026-10-14" })).receivedOn).toBeTruthy();
    expect(parseCertificateInput(valid({ receivedOn: "2026-10-13" }), OPTIONS).ok).toBe(true);
  });

  it("needs between one and five rows", () => {
    expect(errorsOf(valid({ lines: [] })).lines).toBeTruthy();
    const row = valid().lines[0]!;
    expect(errorsOf(valid({ lines: Array.from({ length: 6 }, () => row) })).lines).toBeTruthy();
    expect(parseCertificateInput(valid({ lines: Array.from({ length: 5 }, () => row) }), OPTIONS).ok).toBe(true);
  });

  it("checks each row: ATC, rate, months, total and tax withheld", () => {
    expect(errorsOf(withLine({ atcCode: "" }))["lines.0.atcCode"]).toBeTruthy();
    expect(errorsOf(withLine({ atcCode: "WI 160!" }))["lines.0.atcCode"]).toBeTruthy();
    expect(errorsOf(withLine({ rate: "0" }))["lines.0.rate"]).toBeTruthy();
    expect(errorsOf(withLine({ rate: "101" }))["lines.0.rate"]).toBeTruthy();
    expect(errorsOf(withLine({ rate: "2.555" }))["lines.0.rate"]).toBeTruthy();
    expect(errorsOf(withLine({ month1: "abc" }))["lines.0.month1"]).toBeTruthy();
    expect(errorsOf(withLine({ month1: "₱1,200.50" }))["lines.0.month1"]).toBeTruthy();
    expect(errorsOf(withLine({ month1: "", month2: "", month3: "" }))["lines.0.total"]).toBeTruthy();
    expect(errorsOf(withLine({ taxWithheld: "" }))["lines.0.taxWithheld"]).toBeTruthy();
    expect(errorsOf(withLine({ taxWithheld: "0" }))["lines.0.taxWithheld"]).toBeTruthy();
    expect(errorsOf(withLine({ taxWithheld: "1,700.51" }))["lines.0.taxWithheld"]).toBeTruthy();
  });

  it("accepts tax withheld equal to the income payments", () => {
    expect(parseCertificateInput(withLine({ rate: "100", taxWithheld: "1,700.50" }), OPTIONS).ok).toBe(true);
  });

  it("refuses a payment id that is not an id", () => {
    expect(errorsOf(valid({ paymentIds: ["x"] })).paymentIds).toBeTruthy();
  });

  it("keeps too-long text out", () => {
    expect(errorsOf(valid({ payorName: "x".repeat(121) })).payorName).toBeTruthy();
    expect(errorsOf(valid({ payorAddress: "x".repeat(201) })).payorAddress).toBeTruthy();
    expect(errorsOf(valid({ notes: "x".repeat(501) })).notes).toBeTruthy();
  });
});
