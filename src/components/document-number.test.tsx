import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocumentNumber } from "./document-number";

describe("DocumentNumber", () => {
  it("renders the serial with a decorative Nº prefix", () => {
    const { container } = render(<DocumentNumber number="QUO-000124" />);
    expect(screen.getByText("QUO-000124")).toBeInTheDocument();
    expect(container.querySelector("[aria-hidden='true']")).toHaveTextContent("Nº");
  });

  it("says Draft when no number has been assigned yet", () => {
    render(<DocumentNumber number={null} />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });
});
