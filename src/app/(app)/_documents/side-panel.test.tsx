import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocumentSidePanel, DocumentSidePanelSkeleton } from "./side-panel";
import type { DocumentPanelData } from "./panel-data";

const data = (over: Partial<DocumentPanelData> = {}): DocumentPanelData => ({
  customer: { name: "Juan Dela Cruz", company: "Dela Cruz Bakery", email: "juan@example.com", phone: "0917 555 0100", href: "/customers/c1" },
  facts: [
    { key: "date", label: "Date", value: "Oct 1, 2026" },
    { key: "due", label: "Due date", value: "Oct 12, 2026", note: "3 days overdue", danger: true },
  ],
  events: [
    { key: "sent", label: "Sent", on: "Oct 1, 2026, 9:00 AM" },
    { key: "voided", label: "Voided", on: "Oct 5, 2026, 11:00 AM", detail: "Wrong unit price" },
  ],
  related: [{ key: "quote", label: "From the approved quotation", href: "/quotes/q1" }],
  ...over,
});

const panel = (over?: Partial<DocumentPanelData>) =>
  render(<DocumentSidePanel label="Billing statement details" data={data(over)} />);

describe("DocumentSidePanel", () => {
  it("is a labelled complementary landmark with a heading for each part", () => {
    panel();
    const aside = screen.getByRole("complementary", { name: "Billing statement details" });
    const headings = within(aside).getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["Customer", "Dates", "Activity", "Related"]);
  });

  it("names the customer with a way to their record, and how to reach them", () => {
    panel();
    expect(screen.getByRole("link", { name: "Juan Dela Cruz" })).toHaveAttribute("href", "/customers/c1");
    expect(screen.getByText("Dela Cruz Bakery")).toBeInTheDocument();
    expect(screen.getByText("juan@example.com")).toBeInTheDocument();
    expect(screen.getByText("0917 555 0100")).toBeInTheDocument();
  });

  it("names a customer whose record is gone without a link, and shows only what there is to show of them", () => {
    panel({ customer: { name: "Juan Dela Cruz", company: null, email: null, phone: null, href: null } });
    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Juan Dela Cruz" })).not.toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it("leaves the customer part out for a document without one", () => {
    panel({ customer: null });
    expect(screen.queryByRole("heading", { name: "Customer" })).not.toBeInTheDocument();
  });

  it("pairs each date with its label, and says how near it is, in the danger tone only when it is past due", () => {
    panel();
    const dates = screen.getByRole("heading", { name: "Dates" }).closest("section");
    expect(dates).not.toBeNull();
    const due = within(dates as HTMLElement).getByText("Due date").parentElement;
    expect(due).toHaveTextContent("Oct 12, 2026");
    expect(within(due as HTMLElement).getByText("3 days overdue")).toHaveClass("text-danger-strong");
    const date = within(dates as HTMLElement).getByText("Date").parentElement;
    expect(date).toHaveTextContent("Oct 1, 2026");
  });

  it("does not use the danger tone for a note that is only information", () => {
    panel({ facts: [{ key: "valid", label: "Valid until", value: "Oct 30, 2026", note: "15 days left" }] });
    expect(screen.getByText("15 days left")).not.toHaveClass("text-danger-strong");
  });

  it("lists what happened in the order given, a reason under its event", () => {
    panel();
    const items = screen.getAllByRole("listitem").filter((item) => item.closest("ol"));
    expect(items.map((item) => item.firstElementChild?.textContent)).toEqual(["Sent", "Voided"]);
    expect(items[1]).toHaveTextContent("Oct 5, 2026, 11:00 AM");
    expect(items[1]).toHaveTextContent("Wrong unit price");
  });

  it("leaves out Activity when nothing has happened, and Related when there is nothing related", () => {
    panel({ events: [], related: [] });
    expect(screen.queryByRole("heading", { name: "Activity" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Related" })).not.toBeInTheDocument();
  });

  it("links to what it was made from", () => {
    panel();
    expect(screen.getByRole("link", { name: "From the approved quotation" })).toHaveAttribute("href", "/quotes/q1");
  });
});

describe("DocumentSidePanelSkeleton", () => {
  it("is the panel's own card, divided the same way, so nothing moves when the real one arrives", () => {
    const real = render(<DocumentSidePanel label="Billing statement details" data={data()} />);
    const realCard = real.container.firstElementChild;
    const skeleton = render(<DocumentSidePanelSkeleton />);
    const skeletonCard = skeleton.container.firstElementChild;

    expect(realCard?.tagName).toBe("ASIDE");
    expect(skeletonCard?.className).toBe(realCard?.className);
    // The customer and the dates are always there; the skeleton holds a place for each, and for the activity.
    const classes = (card: Element | null | undefined) => Array.from(card?.children ?? []).map((section) => section.className);
    expect(classes(skeletonCard).slice(0, 3)).toEqual(classes(realCard).slice(0, 3));
  });

  it("says nothing to a screen reader: the page's loading screen speaks for it", () => {
    const { container } = render(<DocumentSidePanelSkeleton />);
    expect(container.querySelector("[role]")).toBeNull();
    expect(container).not.toHaveTextContent(/\w/);
  });
});
