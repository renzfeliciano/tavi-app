import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("answers what this is, why it matters and what to do next", () => {
    render(
      <EmptyState
        title="No customers yet"
        description="Add your first customer to start creating quotes."
        action={<button type="button">Add customer</button>}
      />,
    );

    expect(screen.getByRole("heading", { name: "No customers yet" })).toBeInTheDocument();
    expect(screen.getByText(/start creating quotes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add customer" })).toBeInTheDocument();
  });

  it("uses the requested heading level", () => {
    render(<EmptyState title="Nothing here" description="x" headingLevel={3} />);
    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
  });

  it("keeps the mascot decorative", () => {
    const { container } = render(<EmptyState title="t" description="d" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
