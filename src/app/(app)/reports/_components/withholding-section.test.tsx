import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WithholdingReport } from "@/modules/payments";
import { WithholdingSection } from "./withholding-section";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const report: WithholdingReport = {
  year: 2026,
  quarter: 3,
  received: [
    {
      payorTin: "987-654-321-000",
      payorName: "Dela Cruz Trading",
      currency: "PHP",
      taxWithheldMinor: 2_900,
      lines: [
        { atcCode: "WC160", rateBps: 100, incomeMinor: 40_000, taxWithheldMinor: 400, certificateCount: 1 },
        { atcCode: "WI160", rateBps: 200, incomeMinor: 125_000, taxWithheldMinor: 2_500, certificateCount: 2 },
      ],
    },
    {
      payorTin: "111-222-333-000",
      payorName: "Reyes Hardware Trading",
      currency: "PHP",
      taxWithheldMinor: 600,
      lines: [{ atcCode: "WI160", rateBps: 200, incomeMinor: 30_000, taxWithheldMinor: 600, certificateCount: 1 }],
    },
  ],
  waiting: [{ customerId: "c1", customerName: "Juan Dela Cruz", currency: "PHP", paymentCount: 2, withheldMinor: 1_500 }],
  totals: [{ currency: "PHP", incomeMinor: 195_000, taxWithheldMinor: 3_500 }],
  rows: [],
};

const props = {
  report,
  locale: "en-PH",
  certificate: { name: "BIR Form 2307", short: "2307" },
  taxIdLabel: "TIN",
  years: [2026, 2025],
  carry: { period: "this-quarter" },
  csv: "/reports/csv?report=withholding&year=2026&quarter=3",
};

describe("WithholdingSection", () => {
  it("lists each payor with their TIN and the tax withheld by ATC", () => {
    render(<WithholdingSection {...props} />);
    const payor = screen.getByRole("heading", { name: /Dela Cruz Trading/ }).closest("div") as HTMLElement;

    expect(screen.getByRole("heading", { name: "Dela Cruz Trading · TIN 987-654-321-000" })).toBeInTheDocument();
    expect(within(payor).getByText(/WC160/)).toBeInTheDocument();
    expect(within(payor).getByText(/WI160/)).toHaveTextContent("WI160 · 2% · 2 certificates · income ₱1,250.00");
    expect(within(payor).getByText("₱25.00")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reyes Hardware Trading · TIN 111-222-333-000" })).toBeInTheDocument();
  });

  it("totals the quarter's received certificates, per currency", () => {
    render(<WithholdingSection {...props} />);

    expect(screen.getByText("Income payments")).toBeInTheDocument();
    expect(screen.getByText("₱1,950.00")).toBeInTheDocument();
    expect(screen.getByText("Tax withheld")).toBeInTheDocument();
    expect(screen.getByText("₱35.00")).toBeInTheDocument();
  });

  it("names the currency on the figures when there is more than one", () => {
    render(
      <WithholdingSection
        {...props}
        report={{ ...report, totals: [...report.totals, { currency: "USD", incomeMinor: 10_000, taxWithheldMinor: 200 }] }}
      />,
    );

    expect(screen.getByText("Tax withheld (PHP)")).toBeInTheDocument();
    expect(screen.getByText("Tax withheld (USD)")).toBeInTheDocument();
  });

  it("keeps the payments still waiting apart from the received totals", () => {
    render(<WithholdingSection {...props} />);
    const waiting = screen.getByRole("heading", { name: "Still waiting for 2307" }).closest("div") as HTMLElement;

    expect(within(waiting).getByText(/Juan Dela Cruz/)).toHaveTextContent("Juan Dela Cruz · 2 payments");
    expect(within(waiting).getByText("₱15.00")).toBeInTheDocument();
    // The waiting tax is not in the totals: 25.00 + 4.00 + 6.00 = 35.00.
    expect(screen.queryByText("₱50.00")).not.toBeInTheDocument();
  });

  it("downloads the quarter as a CSV", () => {
    render(<WithholdingSection {...props} />);

    expect(screen.getByRole("link", { name: /Download CSV/ })).toHaveAttribute("href", "/reports/csv?report=withholding&year=2026&quarter=3");
  });

  it("picks the year and quarter on its own, and carries the page's period along", () => {
    const { container } = render(<WithholdingSection {...props} />);

    expect(screen.getByLabelText("Year")).toHaveValue("2026");
    expect(screen.getByLabelText("Quarter")).toHaveValue("3");
    expect(container.querySelector('input[type="hidden"][name="period"]')).toHaveValue("this-quarter");
    expect(screen.getByRole("button", { name: "Show" })).toBeInTheDocument();
  });

  it("says so when nothing has arrived, and still lists what is waiting", () => {
    render(<WithholdingSection {...props} report={{ ...report, received: [], totals: [] }} />);

    expect(screen.getByText("No 2307 certificates received for Q3 2026.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Still waiting for 2307" })).toBeInTheDocument();
  });

  it("has a quiet empty state when there is nothing at all", () => {
    render(<WithholdingSection {...props} report={{ ...report, received: [], waiting: [], totals: [] }} />);

    expect(screen.getByText("No 2307 certificates received for Q3 2026.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Still waiting for 2307" })).not.toBeInTheDocument();
  });
});
