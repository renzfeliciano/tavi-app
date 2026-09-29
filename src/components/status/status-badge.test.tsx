import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("shows the status label as text, not just colour", () => {
    render(<StatusBadge kind="invoice" status="OVERDUE" />);
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("uses the quote vocabulary for quotes", () => {
    render(<StatusBadge kind="quote" status="REJECTED" />);
    expect(screen.getByText("Declined")).toBeInTheDocument();
  });

  it("hides the decorative icon from assistive technology", () => {
    const { container } = render(<StatusBadge kind="quote" status="APPROVED" />);
    const icon = container.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("exposes the plain-language meaning as a title", () => {
    render(<StatusBadge kind="invoice" status="PAID" />);
    expect(screen.getByText("Paid").closest("[title]")).toHaveAttribute(
      "title",
      "Paid in full.",
    );
  });

  it("marks the tone for styling hooks", () => {
    render(<StatusBadge kind="invoice" status="PARTIALLY_PAID" />);
    expect(screen.getByText("Partially paid").closest("[data-tone]")).toHaveAttribute(
      "data-tone",
      "warning",
    );
  });
});
