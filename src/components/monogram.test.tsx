import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { initials, Monogram } from "./monogram";

describe("initials", () => {
  it("takes the first and last words' first letters", () => {
    expect(initials("Juan Dela Cruz")).toBe("JC");
    expect(initials("  ana   reyes ")).toBe("AR");
  });

  it("uses one letter for one word, and a mark when there is no name", () => {
    expect(initials("Santos")).toBe("S");
    expect(initials("   ")).toBe("?");
    expect(initials("")).toBe("?");
  });

  it("keeps a whole letter, not half of an emoji or an accent", () => {
    expect(initials("Élodie Ñ")).toBe("ÉÑ");
    expect(initials("🍞 Bakery")).toBe("🍞B");
  });
});

describe("Monogram", () => {
  it("is decoration: the name is always written beside it", () => {
    const { container } = render(<Monogram name="Juan Dela Cruz" />);

    const mark = container.firstElementChild as HTMLElement;
    expect(mark).toHaveAttribute("aria-hidden", "true");
    expect(mark).toHaveTextContent("JC");
    expect(mark).toHaveClass("rounded-full", "border", "bg-surface-sunken");
  });

  it("grows with the size asked for", () => {
    const { container } = render(<Monogram name="Ana" size="lg" />);
    expect(container.firstElementChild).toHaveClass("size-12");
  });
});
