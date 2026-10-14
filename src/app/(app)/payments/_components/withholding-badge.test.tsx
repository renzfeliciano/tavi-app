import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WithholdingBadge } from "./withholding-badge";

describe("WithholdingBadge", () => {
  it("shows nothing when no tax was withheld", () => {
    const { container } = render(<WithholdingBadge status="none" certificate="2307" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("says 2307 pending, with an icon, in the warning tone", () => {
    const { container } = render(<WithholdingBadge status="pending" certificate="2307" />);

    const badge = screen.getByText("2307 pending");
    expect(badge).toHaveAttribute("data-tone", "warning");
    expect(badge.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });

  it("says 2307 received, with an icon, in the success tone", () => {
    render(<WithholdingBadge status="received" certificate="2307" />);

    expect(screen.getByText("2307 received")).toHaveAttribute("data-tone", "success");
  });

  it("explains itself to anyone who hovers or listens, so colour is never the only signal", () => {
    render(<WithholdingBadge status="pending" certificate="2307" />);

    expect(screen.getByText("2307 pending")).toHaveAttribute("title", "The customer withheld tax and hasn't sent the 2307 yet.");
    render(<WithholdingBadge status="received" certificate="2307" />);
    expect(screen.getByText("2307 received")).toHaveAttribute("title", "The 2307 for this payment is recorded.");
  });

  it("takes the form's name from the market, not from the component", () => {
    render(<WithholdingBadge status="pending" certificate="CWT-01" />);

    expect(screen.getByText("CWT-01 pending")).toBeInTheDocument();
  });

  it("has a smaller size for a line of small type, still keeping its own height", () => {
    render(<WithholdingBadge status="pending" certificate="2307" compact />);

    expect(screen.getByText("2307 pending")).toHaveClass("h-5");
  });
});
