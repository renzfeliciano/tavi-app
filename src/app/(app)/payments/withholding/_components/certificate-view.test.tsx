import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CertificateDetail } from "@/modules/payments";
import { CertificateView } from "./certificate-view";

const detail: CertificateDetail = {
  id: "c1",
  customerId: "cust1",
  customerName: "Juan Dela Cruz",
  payorTin: "123-456-789-00000",
  payorName: "Dela Cruz Trading",
  payorAddress: "123 Rizal Street, Quezon City",
  periodFrom: "2026-07-01",
  periodTo: "2026-09-30",
  receivedOn: "2026-10-05",
  currency: "PHP",
  taxWithheldMinor: 4_501,
  atcCodes: ["WI160"],
  linkedCount: 2,
  hasScan: true,
  reconciliation: { matches: true, differenceMinor: 0 },
  voidedAt: null,
  voidReason: null,
  notes: "Sent by email.",
  fileId: "f1",
  fileName: "2307-q3.pdf",
  lines: [
    { id: "l1", position: 1, atcCode: "WI160", description: "Professional fees", rateBps: 200, monthMinor: [100_000, 0, 125_050], totalMinor: 225_050, taxWithheldMinor: 4_501 },
  ],
  payments: [
    { paymentId: "p1", receiptNumber: "OR-000001", paidOn: "2026-07-01", invoiceId: "i1", invoiceNumber: "INV-000001", amountMinor: 50_000, withheldMinor: 1_000 },
    { paymentId: "p2", receiptNumber: "OR-000002", paidOn: "2026-09-30", invoiceId: "i2", invoiceNumber: null, amountMinor: 80_000, withheldMinor: 3_501 },
  ],
};

const view = (over: Partial<CertificateDetail> = {}) =>
  render(<CertificateView detail={{ ...detail, ...over }} locale="en-PH" certificate={{ name: "BIR Form 2307", short: "2307" }} />);

describe("CertificateView", () => {
  it("shows who withheld, the quarter and when it arrived", () => {
    view();

    expect(screen.getByRole("heading", { name: "Payor" })).toBeInTheDocument();
    expect(screen.getByText("Dela Cruz Trading")).toBeInTheDocument();
    expect(screen.getByText("123-456-789-00000")).toBeInTheDocument();
    expect(screen.getByText("123 Rizal Street, Quezon City")).toBeInTheDocument();
    expect(screen.getByText("Q3 2026 (Jul 1, 2026 to Sep 30, 2026)")).toBeInTheDocument();
    expect(screen.getByText("Oct 5, 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Juan Dela Cruz" })).toHaveAttribute("href", "/customers/cust1");
  });

  it("shows each row with the quarter's month names, its rate and its totals", () => {
    view();
    const row = screen.getByRole("group", { name: "WI160" });

    expect(within(row).getByText("Professional fees")).toBeInTheDocument();
    expect(within(row).getByText("2%")).toBeInTheDocument();
    expect(within(row).getByText("July")).toBeInTheDocument();
    expect(within(row).getByText("₱1,000.00")).toBeInTheDocument();
    expect(within(row).getByText("August")).toBeInTheDocument();
    expect(within(row).getByText("₱1,250.50")).toBeInTheDocument();
    expect(within(row).getByText("₱2,250.50")).toBeInTheDocument();
    expect(within(row).getByText("₱45.01")).toBeInTheDocument();
  });

  it("adds the tax withheld across rows", () => {
    view({
      lines: [
        ...detail.lines,
        { id: "l2", position: 2, atcCode: "WC160", description: null, rateBps: 100, monthMinor: [0, 5_000, 0], totalMinor: 5_000, taxWithheldMinor: 50 },
      ],
    });

    expect(screen.getByText("Total tax withheld")).toBeInTheDocument();
    expect(screen.getByText("₱45.51")).toBeInTheDocument();
  });

  it("says when the payments on it match, and when they differ", () => {
    const { unmount } = view();
    expect(screen.getByText("Matches the tax withheld on the 2 payments on it.")).toBeInTheDocument();
    unmount();

    view({ reconciliation: { matches: false, differenceMinor: -3_000 } });
    // The amount is its own element, so read the whole sentence.
    expect(screen.getByText(/from the tax withheld on the 2 payments on it/)).toHaveTextContent(
      "Differs by ₱30.00 from the tax withheld on the 2 payments on it.",
    );
  });

  it("explains a certificate with no payments on it", () => {
    view({ payments: [], linkedCount: 0, reconciliation: { matches: false, differenceMinor: 4_501 } });

    expect(screen.getByText(/No payments are on this 2307/)).toBeInTheDocument();
  });

  it("links each payment and its billing statement", () => {
    view();
    const list = screen.getByRole("list", { name: "Payments on this 2307" });

    expect(within(list).getByRole("link", { name: "OR-000001" })).toHaveAttribute("href", "/payments/p1");
    expect(within(list).getByRole("link", { name: "INV-000001" })).toHaveAttribute("href", "/invoices/i1");
    expect(within(list).getByRole("link", { name: "OR-000002" })).toHaveAttribute("href", "/payments/p2");
    expect(within(list).getAllByRole("link", { name: /^INV-/ })).toHaveLength(1);
  });

  it("opens the scan, or says there is none", () => {
    const { unmount } = view();
    expect(screen.getByRole("link", { name: "2307-q3.pdf" })).toHaveAttribute("href", "/api/files/f1");
    unmount();

    view({ fileId: null, fileName: null, hasScan: false });
    expect(screen.getByText("No scan attached.")).toBeInTheDocument();
  });

  it("shows the notes when there are some", () => {
    view();
    expect(screen.getByText("Sent by email.")).toBeInTheDocument();
  });

  it("marks a void certificate and gives the reason", () => {
    view({ voidedAt: new Date("2026-10-10T08:00:00Z"), voidReason: "Recorded under the wrong customer." });

    const note = screen.getByRole("note", { name: "Void" });
    expect(within(note).getByText("Recorded under the wrong customer.")).toBeInTheDocument();
    expect(screen.queryByText(/Matches the tax withheld/)).not.toBeInTheDocument();
  });
});
