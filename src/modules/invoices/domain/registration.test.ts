import { describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import { tooLong } from "@/shared/validation/messages";
import {
  formatSerial,
  INVOICE_REGISTRATION_LIMITS,
  buyerTaxIdReminder,
  invoiceTitle,
  parseInvoiceRegistration,
  registrationFooter,
} from "./registration";

const market = MARKETS.PH;
const options = { market, today: "2026-10-02", lastIssuedSerial: null };
const raw = {
  number: " 0412-123-00045 ",
  issuedOn: "2026-09-15",
  seriesStart: "1",
  seriesEnd: "5000",
  title: "Service Invoice",
};

describe("parseInvoiceRegistration", () => {
  it("accepts the certificate number, date, approved series and a title", () => {
    expect(parseInvoiceRegistration(raw, options)).toEqual({
      ok: true,
      registration: { number: "0412-123-00045", issuedOn: "2026-09-15", seriesStart: 1, seriesEnd: 5000, title: "Service Invoice" },
    });
  });

  it("explains each missing or invalid field", () => {
    expect(parseInvoiceRegistration({ number: "", issuedOn: "2026-13-01", seriesStart: "", seriesEnd: "x", title: "Receipt" }, options)).toEqual({
      ok: false,
      errors: {
        number: "Enter the Acknowledgement Certificate or PTU number.",
        issuedOn: "Enter a real date.",
        seriesStart: "Enter a whole number, e.g. 1.",
        seriesEnd: "Enter a whole number, e.g. 5000.",
        title: "Choose a title from the list.",
      },
    });
    expect(parseInvoiceRegistration({ ...raw, number: "x".repeat(INVOICE_REGISTRATION_LIMITS.number + 1) }, options)).toMatchObject({
      errors: { number: tooLong(INVOICE_REGISTRATION_LIMITS.number) },
    });
  });

  it("refuses a future date, an empty or backwards series, and too many digits", () => {
    expect(parseInvoiceRegistration({ ...raw, issuedOn: "2026-10-03" }, options)).toMatchObject({
      errors: { issuedOn: "The date issued can't be in the future." },
    });
    expect(parseInvoiceRegistration({ ...raw, seriesStart: "0" }, options)).toMatchObject({
      errors: { seriesStart: "Serial numbers start at 1 or higher." },
    });
    expect(parseInvoiceRegistration({ ...raw, seriesStart: "5001", seriesEnd: "5000" }, options)).toMatchObject({
      errors: { seriesEnd: "The last serial number can't be lower than the first." },
    });
    expect(parseInvoiceRegistration({ ...raw, seriesEnd: "1".repeat(INVOICE_REGISTRATION_LIMITS.serialDigits + 1) }, options)).toMatchObject({
      errors: { seriesEnd: `Use up to ${INVOICE_REGISTRATION_LIMITS.serialDigits} digits.` },
    });
  });

  it("won't let a new series end before an invoice already issued (serials are never reused)", () => {
    expect(parseInvoiceRegistration({ ...raw, seriesEnd: "40" }, { ...options, lastIssuedSerial: 41 })).toMatchObject({
      errors: { seriesEnd: "You've already issued serial 41. The series must end at 41 or later." },
    });
    expect(parseInvoiceRegistration({ ...raw, seriesEnd: "41" }, { ...options, lastIssuedSerial: 41 })).toMatchObject({ ok: true });
  });

  it("refuses anything that isn't the form's text fields without throwing", () => {
    expect(parseInvoiceRegistration(null, options)).toMatchObject({ ok: false });
    expect(parseInvoiceRegistration({ ...raw, seriesEnd: 5000 }, options)).toMatchObject({ ok: false });
  });

  it("needs a market that registers invoices", () => {
    expect(parseInvoiceRegistration(raw, { ...options, market: { ...market, invoiceRegistration: null } })).toEqual({
      ok: false,
      errors: { number: "Invoice registration isn't available in your country yet." },
    });
  });
});

describe("serials and wording", () => {
  it("pads a serial to the width of the approved series", () => {
    expect(formatSerial(7, 5000)).toBe("0007");
    expect(formatSerial(5000, 5000)).toBe("5000");
    expect(formatSerial(12, 99)).toBe("12");
  });

  it("prints the registration at the foot (RR 7-2024 Sec. 6 B.21)", () => {
    const snapshot = { number: "0412-123-00045", issuedOn: "2026-09-15", seriesStart: 1, seriesEnd: 5000, title: "Invoice", serial: 7 };
    expect(registrationFooter(snapshot, market, "en-PH")).toBe(
      "Acknowledgement Certificate / PTU No. 0412-123-00045 · Date issued Sep 15, 2026 · Approved series 0001 to 5000",
    );
  });

  it("titles a bill by its registration, or as the market's supplementary document", () => {
    expect(invoiceTitle({ registration: null }, market)).toBe("Billing statement");
    expect(invoiceTitle({ registration: { title: "Service Invoice" } }, market)).toBe("Service Invoice");
  });
});

describe("buyerTaxIdReminder (RR 7-2024 Sec. 3 B.4)", () => {
  const rule = market.invoiceRegistration.buyerTaxId;
  const reminder = rule.reminder;

  it("reminds at ₱1,000 or more when the customer has no TIN", () => {
    expect(buyerTaxIdReminder(rule, { currency: "PHP", totalMinor: 100_000, buyerHasTaxId: false })).toBe(reminder);
    expect(buyerTaxIdReminder(rule, { currency: "PHP", totalMinor: 99_999, buyerHasTaxId: false })).toBeNull();
    expect(buyerTaxIdReminder(rule, { currency: "PHP", totalMinor: 500_000, buyerHasTaxId: true })).toBeNull();
  });

  it("only applies in the rule's currency, and not at all outside invoice mode", () => {
    expect(buyerTaxIdReminder(rule, { currency: "USD", totalMinor: 500_000, buyerHasTaxId: false })).toBeNull();
    expect(buyerTaxIdReminder(null, { currency: "PHP", totalMinor: 500_000, buyerHasTaxId: false })).toBeNull();
  });
});

