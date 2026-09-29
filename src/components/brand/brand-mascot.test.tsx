import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandMascot, MASCOT_EXPRESSIONS } from "./brand-mascot";

describe("BrandMascot", () => {
  it("is hidden from assistive technology when decorative", () => {
    const { container } = render(<BrandMascot />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("is announced as an image when given a label", () => {
    render(<BrandMascot label="Stamp, celebrating" expression="celebrating" />);
    expect(screen.getByRole("img", { name: "Stamp, celebrating" })).toBeInTheDocument();
  });

  it.each(MASCOT_EXPRESSIONS)("renders the %s expression", (expression) => {
    const { container } = render(<BrandMascot expression={expression} />);
    expect(container.querySelector("svg")).toHaveAttribute("data-expression", expression);
  });

  it("only animates when asked to", () => {
    const { container, rerender } = render(<BrandMascot />);
    expect(container.querySelector("svg")).not.toHaveAttribute("data-animated");
    rerender(<BrandMascot animated />);
    expect(container.querySelector("svg")).toHaveAttribute("data-animated", "true");
  });
});
