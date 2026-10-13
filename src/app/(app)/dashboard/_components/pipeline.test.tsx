import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EMPTY_STAGE, type PipelineStage } from "@/shared/pipeline/stage";
import { Pipeline } from "./pipeline";

const names = { quote: { singular: "Quotation", plural: "Quotations" }, invoice: { singular: "Billing statement", plural: "Billing statements" } };
const stage = (count: number, ...totals: [string, number][]): PipelineStage => ({
  count,
  totals: totals.map(([currency, totalMinor]) => ({ currency, count: totals.length === 1 ? count : 1, totalMinor })),
});

function pipeline(over: { quotes?: Partial<Parameters<typeof Pipeline>[0]["quotes"]>; invoices?: Partial<Parameters<typeof Pipeline>[0]["invoices"]> } = {}) {
  return render(
    <Pipeline
      locale="en-PH"
      names={names}
      quotes={{ drafts: stage(1, ["PHP", 100000]), sent: stage(2, ["PHP", 350000]), viewed: stage(1, ["PHP", 80000]), approved: stage(3, ["PHP", 900000]), ...over.quotes }}
      invoices={{ drafts: EMPTY_STAGE, unpaid: stage(2, ["PHP", 400000]), overdue: stage(1, ["PHP", 120000]), ...over.invoices }}
    />,
  );
}

describe("Pipeline", () => {
  it("is one titled section with a row for quotations and one for billing statements", () => {
    pipeline();
    const section = screen.getByRole("region", { name: "Pipeline" });

    expect(within(section).getByRole("link", { name: "Quotations" })).toHaveAttribute("href", "/quotes");
    expect(within(section).getByRole("link", { name: "Billing statements" })).toHaveAttribute("href", "/invoices");
  });

  it("walks a quotation from draft to approved, each stage a link to that status", () => {
    pipeline();
    const quotes = screen.getByRole("group", { name: "Quotations" });

    for (const [label, status] of [["Draft", "draft"], ["Sent", "sent"], ["Viewed", "viewed"], ["Approved", "approved"]] as const) {
      expect(within(quotes).getByRole("link", { name: new RegExp(`^${label}`) })).toHaveAttribute("href", `/quotes?status=${status}`);
    }
  });

  it("walks a billing statement from draft to overdue", () => {
    pipeline();
    const invoices = screen.getByRole("group", { name: "Billing statements" });

    expect(within(invoices).getByRole("link", { name: /^Draft/ })).toHaveAttribute("href", "/invoices?status=draft");
    expect(within(invoices).getByRole("link", { name: /^Unpaid/ })).toHaveAttribute("href", "/invoices");
    expect(within(invoices).getByRole("link", { name: /^Overdue/ })).toHaveAttribute("href", "/invoices?status=overdue");
  });

  it("says how many are in a stage and what they are worth", () => {
    pipeline();
    const approved = screen.getByRole("link", { name: /^Approved/ });

    expect(approved).toHaveTextContent("3");
    expect(approved).toHaveTextContent("₱9,000.00");
    expect(approved).toHaveTextContent("Ready to bill");
  });

  it("lists each currency's worth on its own line and never adds them together", () => {
    pipeline({ quotes: { sent: stage(3, ["PHP", 350000], ["USD", 9900]) } });
    const sent = screen.getByRole("link", { name: /^Sent/ });

    expect(sent).toHaveTextContent("3");
    expect(within(sent).getByText("₱3,500.00")).toBeInTheDocument();
    expect(within(sent).getByText("$99.00")).toBeInTheDocument();
  });

  it("shows an empty stage as a plain zero with no money under it", () => {
    pipeline({ invoices: { drafts: EMPTY_STAGE } });
    const drafts = within(screen.getByRole("group", { name: "Billing statements" })).getByRole("link", { name: /^Draft/ });

    expect(drafts).toHaveTextContent("0");
    expect(drafts.querySelector("data")).toBeNull();
  });

  it("draws overdue in danger ink only when something is overdue", () => {
    const { unmount } = pipeline();
    const late = screen.getByRole("link", { name: /^Overdue/ });
    expect(within(late).getByText("₱1,200.00")).toHaveClass("text-danger-strong");
    unmount();

    pipeline({ invoices: { overdue: EMPTY_STAGE } });
    expect(screen.getByRole("link", { name: /^Overdue/ }).querySelector(".text-danger-strong")).toBeNull();
  });
});
