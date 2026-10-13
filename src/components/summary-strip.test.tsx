import { render, screen, within } from "@testing-library/react";
import type { Route } from "next";
import { describe, expect, it } from "vitest";
import { SummaryStripSkeleton } from "./skeletons";
import { type Figure, SummaryStrip } from "./summary-strip";

const figure = (over: Partial<Figure> = {}): Figure => ({ key: "sent", label: "Sent", value: "₱3,500.00", detail: "2 quotations", ...over });
const strip = (figures: Figure[]) => render(<SummaryStrip label="Quotation summary" rows={[{ key: "PHP", figures }]} />);

describe("SummaryStrip", () => {
  it("is a labelled region of figures, each with its label, value and what makes it up", () => {
    strip([figure(), figure({ key: "approved", label: "Approved", value: "₱9,000.00", detail: "3 quotations" })]);
    const region = screen.getByRole("region", { name: "Quotation summary" });

    expect(within(region).getAllByRole("listitem")).toHaveLength(2);
    expect(region).toHaveTextContent("Sent");
    expect(region).toHaveTextContent("₱3,500.00");
    expect(region).toHaveTextContent("2 quotations");
    expect(region).toHaveTextContent("Approved");
  });

  it("makes a figure with somewhere to go a link, and leaves the rest as plain text", () => {
    strip([figure({ href: "/quotes?status=sent" as Route }), figure({ key: "approved", label: "Approved" })]);

    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Sent/ })).toHaveAttribute("href", "/quotes?status=sent");
  });

  it("draws a danger figure in danger ink and no other", () => {
    strip([figure({ key: "late", label: "Overdue", value: "₱8,200.00", tone: "danger" }), figure()]);

    expect(screen.getByText("₱8,200.00")).toHaveClass("text-danger-strong");
    expect(screen.getByText("₱3,500.00")).not.toHaveClass("text-danger-strong");
  });

  it("lets a phone, which has room for two figures, leave one out", () => {
    strip([figure(), figure({ key: "viewed", label: "Viewed" }), figure({ key: "drafts", label: "Drafts", phone: false })]);
    const items = screen.getAllByRole("listitem");

    expect(items[2]).toHaveClass("max-sm:hidden");
    expect(items[0]).not.toHaveClass("max-sm:hidden");
  });

  it("stacks a row for each currency", () => {
    render(
      <SummaryStrip
        label="Billing statement summary"
        rows={[
          { key: "PHP", figures: [figure({ label: "Outstanding (PHP)" })] },
          { key: "USD", figures: [figure({ label: "Outstanding (USD)" })] },
        ]}
      />,
    );

    expect(screen.getAllByRole("list")).toHaveLength(2);
    expect(screen.getByText("Outstanding (USD)")).toBeInTheDocument();
  });

  it("shows nothing when there is nothing to total", () => {
    const { container } = render(<SummaryStrip label="Quotation summary" rows={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("has a skeleton with the same container and tiles, leaving the same ones off a phone", () => {
    const real = strip([figure(), figure({ key: "b" }), figure({ key: "c", phone: false })]).container;
    const drawn = render(<SummaryStripSkeleton figures={3} phoneHides={2} />).container;
    const hidden = (container: HTMLElement) => [...container.querySelectorAll("li")].map((li) => li.classList.contains("max-sm:hidden"));

    expect(drawn.firstElementChild?.className).toBe(real.firstElementChild?.className);
    expect(drawn.querySelector("ul")?.className).toBe(real.querySelector("ul")?.className);
    expect(hidden(drawn)).toEqual(hidden(real));
  });
});
