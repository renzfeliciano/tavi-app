import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SummaryStrip } from "@/components/summary-strip";
import type { PipelineStage } from "@/shared/pipeline/stage";
import { EMPTY_STAGE } from "@/shared/pipeline/stage";
import { invoiceStrip, quoteStrip } from "./summary";

const stage = (...totals: [string, number, number][]): PipelineStage => ({
  count: totals.reduce((sum, [, count]) => sum + count, 0),
  totals: totals.map(([currency, count, totalMinor]) => ({ currency, count, totalMinor })),
});
const quoteNames = { singular: "Quotation", plural: "Quotations" };
const invoiceNames = { singular: "Billing statement", plural: "Billing statements" };

describe("quoteStrip", () => {
  const pipeline = (over: Partial<Record<"drafts" | "sent" | "viewed" | "approved", PipelineStage>> = {}) => ({
    drafts: stage(["PHP", 4, 920_000]),
    sent: stage(["PHP", 2, 350_000]),
    viewed: stage(["PHP", 1, 80_000]),
    approved: stage(["PHP", 3, 900_000]),
    ...over,
  });
  const strip = (over?: Parameters<typeof pipeline>[0]) =>
    render(<SummaryStrip label="Quotation summary" rows={quoteStrip(pipeline(over), quoteNames, { locale: "en-PH", currency: "PHP" })} />);

  it("shows what is sent, viewed and approved, each worth and count linked to its status tab", () => {
    strip();

    const sent = screen.getByRole("link", { name: /^Sent/ });
    expect(sent).toHaveAttribute("href", "/quotes?status=sent");
    expect(sent).toHaveTextContent("₱3,500.00");
    expect(sent).toHaveTextContent("2 quotations");
    const viewed = screen.getByRole("link", { name: /^Viewed/ });
    expect(viewed).toHaveAttribute("href", "/quotes?status=viewed");
    expect(viewed).toHaveTextContent("1 quotation");
    expect(viewed).not.toHaveTextContent("1 quotations");
    const approved = screen.getByRole("link", { name: /^Approved/ });
    expect(approved).toHaveAttribute("href", "/quotes?status=approved");
    expect(approved).toHaveTextContent("₱9,000.00");
    expect(approved).toHaveTextContent("3 quotations to bill");
  });

  it("shows zero for a stage with nothing in it, while another has something", () => {
    strip({ viewed: EMPTY_STAGE });

    const viewed = screen.getByRole("link", { name: /^Viewed/ });
    expect(viewed).toHaveTextContent("₱0.00");
    expect(viewed).toHaveTextContent("None");
  });

  it("stacks a row for each currency and names the currency on its figures", () => {
    strip({ sent: stage(["PHP", 2, 350_000], ["USD", 1, 9_900]) });

    expect(screen.getAllByRole("list")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /^Sent \(PHP\)/ })).toHaveTextContent("₱3,500.00");
    expect(screen.getByRole("link", { name: /^Sent \(USD\)/ })).toHaveTextContent("$99.00");
  });

  it("leaves the currency off the labels when there is only one", () => {
    strip();

    expect(screen.getByRole("link", { name: /^Sent/ })).not.toHaveTextContent("(PHP)");
  });

  it("shows zeros in the business's own currency while nothing is out with customers", () => {
    strip({ sent: EMPTY_STAGE, viewed: EMPTY_STAGE, approved: EMPTY_STAGE });

    expect(screen.getAllByRole("list")).toHaveLength(1);
    for (const name of [/^Sent/, /^Viewed/, /^Approved/]) {
      expect(screen.getByRole("link", { name })).toHaveTextContent("₱0.00");
      expect(screen.getByRole("link", { name })).toHaveTextContent("None");
    }
  });

  it("keeps the business's own currency first-class when only another currency has quotations", () => {
    strip({ sent: stage(["USD", 1, 9_900]), viewed: EMPTY_STAGE, approved: EMPTY_STAGE });

    expect(screen.getAllByRole("list")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /^Sent \(PHP\)/ })).toHaveTextContent("₱0.00");
    expect(screen.getByRole("link", { name: /^Sent \(USD\)/ })).toHaveTextContent("$99.00");
  });

  it("lets a phone leave out Viewed, keeping what is out with customers and what is won", () => {
    strip();

    const [sent, viewed, approved] = screen.getAllByRole("listitem");
    expect(viewed).toHaveClass("max-sm:hidden");
    expect(sent).not.toHaveClass("max-sm:hidden");
    expect(approved).not.toHaveClass("max-sm:hidden");
  });
});

describe("invoiceStrip", () => {
  const money = (over: Partial<Parameters<typeof invoiceStrip>[0]["money"][number]> = {}) => ({
    currency: "PHP",
    outstandingMinor: 500_000,
    outstandingCount: 3,
    overdueMinor: 200_000,
    overdueCount: 2,
    oldestOverdueDue: "2026-10-01",
    ...over,
  });
  const strip = (over: Partial<Parameters<typeof invoiceStrip>[0]> = {}) =>
    render(
      <SummaryStrip
        label="Billing statement summary"
        rows={invoiceStrip({ money: [money()], drafts: stage(["PHP", 1, 75_000]), names: invoiceNames, today: "2026-10-12", locale: "en-PH", currency: "PHP", ...over })}
      />,
    );

  it("shows what is owed, what is late and what is still a draft, each linked to its list", () => {
    strip();

    const outstanding = screen.getByRole("link", { name: /^Outstanding/ });
    expect(outstanding).toHaveAttribute("href", "/invoices");
    expect(outstanding).toHaveTextContent("₱5,000.00");
    expect(outstanding).toHaveTextContent("3 billing statements");
    const overdue = screen.getByRole("link", { name: /^Overdue/ });
    expect(overdue).toHaveAttribute("href", "/invoices?status=overdue");
    expect(overdue).toHaveTextContent("₱2,000.00");
    expect(overdue).toHaveTextContent("2 billing statements · oldest 11 days late");
    const drafts = screen.getByRole("link", { name: /^Drafts/ });
    expect(drafts).toHaveAttribute("href", "/invoices?status=draft");
    expect(drafts).toHaveTextContent("₱750.00");
    expect(drafts).toHaveTextContent("1 billing statement");
  });

  it("draws overdue in danger ink only when something is overdue", () => {
    const { unmount } = strip();
    expect(within(screen.getByRole("link", { name: /^Overdue/ })).getByText("₱2,000.00").closest("span")).toHaveClass("text-danger-strong");
    unmount();

    strip({ money: [money({ overdueMinor: 0, overdueCount: 0, oldestOverdueDue: null })] });
    const calm = screen.getByRole("link", { name: /^Overdue/ });
    expect(calm).toHaveTextContent("Nothing overdue");
    expect(calm.querySelector(".text-danger-strong")).toBeNull();
  });

  it("shows no drafts as zero and None", () => {
    strip({ drafts: EMPTY_STAGE });

    expect(screen.getByRole("link", { name: /^Drafts/ })).toHaveTextContent("₱0.00");
    expect(screen.getByRole("link", { name: /^Drafts/ })).toHaveTextContent("None");
  });

  it("includes a currency that only has drafts next to one that only has bills", () => {
    strip({ money: [money()], drafts: stage(["USD", 1, 9_900]) });

    expect(screen.getAllByRole("list")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /^Drafts \(USD\)/ })).toHaveTextContent("$99.00");
    expect(screen.getByRole("link", { name: /^Outstanding \(USD\)/ })).toHaveTextContent("$0.00");
  });

  it("says nothing is owed, in the business's own currency, when there are no bills and no drafts", () => {
    strip({ money: [], drafts: EMPTY_STAGE });

    expect(screen.getAllByRole("list")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /^Outstanding/ })).toHaveTextContent("₱0.00");
    expect(screen.getByRole("link", { name: /^Outstanding/ })).toHaveTextContent("Nothing owed");
    expect(screen.getByRole("link", { name: /^Overdue/ })).toHaveTextContent("Nothing overdue");
  });

  it("lets a phone leave out the drafts", () => {
    strip();

    const items = screen.getAllByRole("listitem");
    expect(items[2]).toHaveClass("max-sm:hidden");
    expect(items[0]).not.toHaveClass("max-sm:hidden");
  });
});
