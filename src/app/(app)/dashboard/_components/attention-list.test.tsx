import { render, screen, within } from "@testing-library/react";
import type { Route } from "next";
import { describe, expect, it } from "vitest";
import type { AttentionItem } from "../_lib/attention-items";
import { AttentionList } from "./attention-list";

const overdue: AttentionItem = {
  key: "overdue-i1",
  kind: "overdue",
  href: "/invoices/i1" as Route,
  number: "INV-000001",
  detail: "Maria Santos · due Oct 1, 2026",
  late: "11 days late",
  amount: { minor: 50000, currency: "PHP" },
};
const draft: AttentionItem = { key: "draft-q3", kind: "draft", href: "/quotes/q3" as Route, number: null, title: "Juan Dela Cruz", detail: "last edited 3 days ago" };
const approved: AttentionItem = {
  key: "approved-q1",
  kind: "approved",
  href: "/quotes/q1" as Route,
  number: "QUO-000001",
  detail: "Juan Dela Cruz · approved 2 days ago",
  amount: { minor: 120000, currency: "PHP" },
};
const waiting: AttentionItem = { ...approved, key: "waiting-q2", kind: "waiting", number: "QUO-000002", detail: "Juan Dela Cruz · sent 9 days ago" };

describe("AttentionList", () => {
  it("is titled and lists each thing as a link to its page", () => {
    render(<AttentionList items={[overdue, draft]} locale="en-PH" />);

    expect(screen.getByRole("heading", { level: 2, name: "Needs your attention" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /INV-000001/ })).toHaveAttribute("href", "/invoices/i1");
    expect(screen.getByRole("link", { name: /Juan Dela Cruz/ })).toHaveAttribute("href", "/quotes/q3");
  });

  it("says what kind of thing it is in words, not by icon alone", () => {
    render(<AttentionList items={[overdue, approved, waiting, draft]} locale="en-PH" />);
    const links = screen.getAllByRole("link");

    expect(links[0]).toHaveTextContent("Overdue");
    expect(links[1]).toHaveTextContent("Approved, ready to bill");
    expect(links[2]).toHaveTextContent("No answer yet");
    expect(links[3]).toHaveTextContent("Unfinished draft");
  });

  it("shows how late an overdue bill is, in danger ink, beside its balance", () => {
    render(<AttentionList items={[overdue]} locale="en-PH" />);
    const link = screen.getByRole("link", { name: /INV-000001/ });

    expect(link).toHaveTextContent("₱500.00");
    expect(within(link).getByText("11 days late")).toHaveClass("text-danger-strong");
    expect(link).toHaveTextContent("Maria Santos · due Oct 1, 2026");
  });

  it("shows a quote's worth, and nothing on the right of a draft", () => {
    render(<AttentionList items={[approved, draft]} locale="en-PH" />);
    const [quote, unfinished] = screen.getAllByRole("link");

    expect(quote).toHaveTextContent("₱1,200.00");
    expect(unfinished?.querySelector("data")).toBeNull();
  });

  it("says so when nothing needs attention", () => {
    render(<AttentionList items={[]} locale="en-PH" />);

    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
