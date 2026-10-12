import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LogoMark } from "./logo-mark";
import { Wordmark } from "./wordmark";

describe("LogoMark", () => {
  it("is decorative and sized from its height", () => {
    const { container } = render(<LogoMark size={36} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveStyle({ height: "36px" });
    expect(Number.parseFloat(svg!.style.width)).toBeCloseTo(36 * (336 / 468), 1);
  });
});

describe("Wordmark", () => {
  it("is announced as TAVI with or without the logo", () => {
    const plain = render(<Wordmark />);
    expect(plain.getByRole("img", { name: "TAVI" })).toBeInTheDocument();
    expect(plain.container.querySelectorAll("svg")).toHaveLength(1);
    plain.unmount();

    const withMark = render(<Wordmark mark />);
    expect(withMark.getByRole("img", { name: "TAVI" })).toBeInTheDocument();
    expect(withMark.container.querySelectorAll("svg")).toHaveLength(2);
  });
});
