import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CertificateSummary } from "@/modules/payments";
import { certificateColumns, certificateSummaryLine, quarterLabel } from "./certificate-list";

const certificate = (over: Partial<CertificateSummary> = {}): CertificateSummary => ({
  id: "c1",
  customerId: "u1",
  customerName: "Juan Dela Cruz",
  payorTin: "987-654-321-000",
  payorName: "Dela Cruz Trading",
  periodFrom: "2026-07-01",
  periodTo: "2026-09-30",
  receivedOn: "2026-10-05",
  currency: "PHP",
  taxWithheldMinor: 6_000,
  atcCodes: ["WI160"],
  linkedCount: 1,
  hasScan: true,
  reconciliation: { matches: true, differenceMinor: 0 },
  voidedAt: null,
  ...over,
});

const cell = (id: string, row: CertificateSummary) => {
  const column = certificateColumns("en-PH").find((c) => c.id === id);
  if (!column) throw new Error(`no ${id} column`);
  return render(<>{column.cell(row)}</>);
};

describe("quarterLabel", () => {
  it("names the calendar quarter of the period's first day", () => {
    expect(quarterLabel("2026-07-01")).toBe("Q3 2026");
    expect(quarterLabel("2026-12-31")).toBe("Q4 2026");
    expect(quarterLabel("2027-01-01")).toBe("Q1 2027");
    expect(quarterLabel("2026-04-01")).toBe("Q2 2026");
  });
});

describe("certificate list columns", () => {
  it("leads with the payor, then the quarter and the ATC codes", () => {
    cell("payor", certificate({ atcCodes: ["WI160", "WC160"] }));

    expect(screen.getByText("Dela Cruz Trading")).toBeInTheDocument();
    expect(screen.getByText("Q3 2026 · WI160, WC160")).toBeInTheDocument();
  });

  it("says when it arrived and whether the scan is kept, in words", () => {
    const { unmount } = cell("received", certificate());
    expect(screen.getByText("Oct 5, 2026")).toBeInTheDocument();
    expect(screen.getByText("Scan attached")).toBeInTheDocument();
    unmount();

    cell("received", certificate({ hasScan: false }));
    expect(screen.getByText("No scan")).toBeInTheDocument();
  });

  it("says Matches when the payments add up to the form, and by how much it differs when they don't", () => {
    const { unmount } = cell("check", certificate());
    expect(screen.getByText("Matches")).toBeInTheDocument();
    unmount();

    cell("check", certificate({ reconciliation: { matches: false, differenceMinor: 500 } }));
    expect(screen.getByText("Differs by ₱5.00")).toBeInTheDocument();
  });

  it("shows the tax withheld, struck through once void", () => {
    const { unmount } = cell("tax", certificate());
    expect(screen.getByText("₱60.00")).not.toHaveClass("line-through");
    unmount();

    cell("tax", certificate({ voidedAt: new Date("2026-10-06T00:00:00Z") }));
    expect(screen.getByText("₱60.00")).toHaveClass("line-through");
  });

  it("gives a phone the quarter, when it arrived and the check on one line", () => {
    expect(certificateSummaryLine("en-PH")(certificate())).toBe("Q3 2026 · received Oct 5, 2026 · Matches");
    expect(certificateSummaryLine("en-PH")(certificate({ reconciliation: { matches: false, differenceMinor: 500 }, voidedAt: new Date() }))).toBe(
      "Q3 2026 · received Oct 5, 2026 · Differs by ₱5.00 · Void",
    );
  });
});
