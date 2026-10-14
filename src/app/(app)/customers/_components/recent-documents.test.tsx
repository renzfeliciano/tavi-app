import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MARKETS } from "@/config/markets";
import type { InvoiceList } from "@/modules/invoices";
import type { QuoteList } from "@/modules/quotes";
import { RecentDocuments, RecentDocumentsSkeleton } from "./recent-documents";

type Quote = QuoteList["quotes"][number];
type Invoice = InvoiceList["invoices"][number];

const quote = (over: Partial<Quote> = {}): Quote => ({
  id: "q1",
  number: "QUO-000007",
  revision: 1,
  status: "SENT",
  currency: "PHP",
  totalMinor: 150_000,
  issueDate: "2026-10-01",
  validUntil: "2026-10-15",
  updatedAt: new Date("2026-10-01T02:00:00Z"),
  customerName: "Juan Dela Cruz",
  ...over,
});
const invoice = (over: Partial<Invoice> = {}): Invoice => ({
  id: "i1",
  number: "INV-000012",
  revision: 1,
  status: "OVERDUE",
  currency: "PHP",
  totalMinor: 250_000,
  amountPaidMinor: 50_000,
  issueDate: "2026-09-01",
  dueDate: "2026-09-15",
  updatedAt: new Date("2026-09-01T02:00:00Z"),
  customerName: "Juan Dela Cruz",
  ...over,
});

const quotes = (rows: Quote[], total = rows.length, extra: { canCreate?: boolean } = {}) =>
  render(<RecentDocuments kind="quote" rows={rows} total={total} customerId="c1" locale="en-PH" market={MARKETS.PH} canCreate={extra.canCreate ?? true} />);
const invoices = (rows: Invoice[], total = rows.length) =>
  render(<RecentDocuments kind="invoice" rows={rows} total={total} customerId="c1" locale="en-PH" market={MARKETS.PH} canCreate />);

describe("RecentDocuments", () => {
  it("lists their quotations under the market's own name for them, each one a link to the quotation", () => {
    quotes([quote()]);
    const section = screen.getByRole("region", { name: "Quotations" });
    const link = within(section).getByRole("link", { name: /QUO-000007/ });

    expect(link).toHaveAttribute("href", "/quotes/q1");
    expect(link).toHaveTextContent("Sent");
    expect(link).toHaveTextContent("₱1,500.00");
    expect(link).toHaveTextContent("Oct 1, 2026");
  });

  it("lists their billing statements, each with its status and amount", () => {
    invoices([invoice()]);
    const section = screen.getByRole("region", { name: "Billing statements" });
    const link = within(section).getByRole("link", { name: /INV-000012/ });

    expect(link).toHaveAttribute("href", "/invoices/i1");
    expect(link).toHaveTextContent("Overdue");
    expect(link).toHaveTextContent("₱2,500.00");
    expect(link).toHaveTextContent("Due Sep 15, 2026");
  });

  it("says how much of a part-paid statement has come in", () => {
    invoices([invoice({ status: "PARTIALLY_PAID" })]);

    expect(screen.getByRole("link", { name: /INV-000012/ })).toHaveTextContent("₱500.00 paid");
  });

  it("calls a document with no number yet a draft", () => {
    quotes([quote({ number: null, status: "DRAFT" })]);

    expect(screen.getByRole("link", { name: /Draft/ })).toBeInTheDocument();
  });

  it("says how many are shown when there are more than the list holds", () => {
    quotes([quote(), quote({ id: "q2", number: "QUO-000008" })], 12);

    expect(screen.getByText("Latest 2 of 12")).toBeInTheDocument();
  });

  it("says nothing about counts when they are all there", () => {
    quotes([quote()], 1);

    expect(screen.queryByText(/Latest/)).toBeNull();
  });

  it("offers to start one for this customer, which opens the new document with them already chosen", () => {
    quotes([quote()]);
    expect(screen.getByRole("link", { name: "New quotation" })).toHaveAttribute("href", "/quotes/new?customer=c1");
  });

  it("starts a billing statement the same way", () => {
    invoices([invoice()]);
    expect(screen.getByRole("link", { name: "New billing statement" })).toHaveAttribute("href", "/invoices/new?customer=c1");
  });

  it("offers nothing to start for an archived customer", () => {
    quotes([quote()], 1, { canCreate: false });

    expect(screen.queryByRole("link", { name: "New quotation" })).toBeNull();
  });

  it("says so when there are none yet, in the market's words", () => {
    quotes([]);
    expect(screen.getByText("No quotations yet.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("says so for billing statements too", () => {
    invoices([]);
    expect(screen.getByText("No billing statements yet.")).toBeInTheDocument();
  });
});

describe("RecentDocumentsSkeleton", () => {
  it("draws the rows the list will have, in the list's own container, so nothing jumps when they arrive", () => {
    const { container } = render(<RecentDocumentsSkeleton rows={3} />);
    const real = render(<RecentDocuments kind="quote" rows={[quote()]} total={1} customerId="c1" locale="en-PH" market={MARKETS.PH} canCreate />);

    expect(container.querySelectorAll("li")).toHaveLength(3);
    const classes = (root: HTMLElement) => root.querySelector("ul")?.className;
    expect(classes(container)).toBe(classes(real.container));
    // Not `li > *`: jsdom's selector engine caches a child-combinator query against the first root it saw
    // and then misses in the next, so the row is reached through the DOM instead.
    const row = (root: HTMLElement) => root.querySelector("li")?.firstElementChild?.className;
    expect(row(container)).toBe(row(real.container));
  });

  it("holds the height of the status badge in each row: 1.5rem, which is what makes the row as tall as the real one", () => {
    const { container } = render(<RecentDocumentsSkeleton rows={2} />);
    const real = render(<RecentDocuments kind="quote" rows={[quote()]} total={1} customerId="c1" locale="en-PH" market={MARKETS.PH} canCreate />);

    // The row's first line is the number and then the badge; the real badge is the last thing on it.
    const badge = (root: HTMLElement) => root.querySelector("li span.flex")?.lastElementChild;
    expect(badge(real.container)).toHaveClass("h-6");
    for (const row of container.querySelectorAll("li")) {
      expect(row.querySelector("span.flex")?.lastElementChild).toHaveClass("h-6");
    }
    expect(badge(container)).toHaveClass("h-6");
  });
});
