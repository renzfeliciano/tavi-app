import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { brand } from "@/config/brand";
import Home from "./page";

describe("Home (holding page)", () => {
  it("shows the TAVI wordmark as the page heading", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: brand.wordmark }),
    ).toBeInTheDocument();
  });

  it("shows the primary tagline", () => {
    render(<Home />);

    expect(screen.getByText(brand.taglines.primary)).toBeInTheDocument();
  });
});
