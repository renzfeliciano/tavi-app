import { describe, expect, it } from "vitest";
import { INVOICE_STATUSES } from "@/modules/invoices";
import { QUOTE_STATUSES } from "@/modules/quotes";
import {
  invoiceStatusPresentation,
  quoteStatusPresentation,
  type StatusPresentation,
} from "./presentation";

function expectComplete(p: StatusPresentation) {
  expect(p.label.trim()).not.toBe("");
  expect(p.description.trim()).not.toBe("");
  // Colour is never the only signal: every status carries an icon too.
  expect(p.icon).toBeTruthy();
}

describe("quote status presentation", () => {
  it.each(QUOTE_STATUSES)("%s has a label, description and icon", (status) => {
    expectComplete(quoteStatusPresentation[status]);
  });

  it("uses distinct labels for every status", () => {
    const labels = QUOTE_STATUSES.map((s) => quoteStatusPresentation[s].label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("marks approval as success and rejection as danger", () => {
    expect(quoteStatusPresentation.APPROVED.tone).toBe("success");
    expect(quoteStatusPresentation.REJECTED.tone).toBe("danger");
  });
});

describe("invoice status presentation", () => {
  it.each(INVOICE_STATUSES)("%s has a label, description and icon", (status) => {
    expectComplete(invoiceStatusPresentation[status]);
  });

  it("uses distinct labels for every status", () => {
    const labels = INVOICE_STATUSES.map(
      (s) => invoiceStatusPresentation[s].label,
    );
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("maps money states to the right tones", () => {
    expect(invoiceStatusPresentation.PAID.tone).toBe("success");
    expect(invoiceStatusPresentation.PARTIALLY_PAID.tone).toBe("warning");
    expect(invoiceStatusPresentation.OVERDUE.tone).toBe("danger");
    expect(invoiceStatusPresentation.VOID.tone).toBe("muted");
  });
});
