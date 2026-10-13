import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./page-header";

// Layout can't be measured in jsdom, so these pin the classes; the measurement
// itself, on a real page at a zoomed laptop width, is in e2e/invoices.spec.ts.

describe("PageHeader", () => {
  it("shows the title, description and actions", () => {
    render(<PageHeader title="Billing statement INV-000001" description="Rosa Reyes" actions={<button type="button">Edit</button>} />);

    expect(screen.getByRole("heading", { level: 1, name: "Billing statement INV-000001" })).toBeInTheDocument();
    expect(screen.getByText("Rosa Reyes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("lets the actions drop under the title when they don't fit beside it, rather than squeezing the title onto two lines", () => {
    render(<PageHeader title="Billing statement INV-000001" actions={<button type="button">Edit</button>} />);

    const header = screen.getByRole("banner");
    expect(header).toHaveClass("sm:flex-wrap");
    // On its own row the actions keep to the right edge, where they sit when beside the title.
    expect(screen.getByRole("button", { name: "Edit" }).parentElement).toHaveClass("sm:ml-auto");
  });
});
