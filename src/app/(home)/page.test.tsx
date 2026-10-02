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

  it("offers sign-in and account creation", () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/sign-up",
    );
  });

  it("links the Terms of Service and Privacy Notice", () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  });
});
