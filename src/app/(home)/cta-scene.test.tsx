import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CtaScene } from "./cta-scene";

// The scene beside the closing words: a billing statement that is still owing,
// and the Stamp, which lowers onto it, presses, and leaves PAID, then lifts and
// goes again. It plays by itself in CSS (home.css: opacity and transform only,
// and only for people who have not asked for less motion); without motion it is
// the stamped, settled statement with the Stamp above it. Made-up people and
// figures from the sample quotation, and decoration only.

const mount = () => render(<CtaScene invoice="Billing statement" />);

describe("CtaScene", () => {
  it("is decoration, and its statement is on a light sheet like the real one", () => {
    const { container } = mount();

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    const sheet = container.querySelector(".home-cta-sheet")!;
    expect(sheet).toHaveAttribute("data-theme", "light");
    expect(sheet).toHaveTextContent("Billing statement");
    expect(sheet).toHaveTextContent("INV-000012");
    expect(sheet).toHaveTextContent("Renzo Feliciano Payod Repair Services");
    expect(sheet).toHaveTextContent("Check-up and labour");
  });

  it("shows what is owing before the stamp and what is left after it", () => {
    const { container } = mount();

    expect(container.querySelector(".home-cta-before")).toHaveTextContent("₱4,500.00");
    expect(container.querySelector(".home-cta-before")).toHaveTextContent("Unpaid");
    expect(container.querySelector(".home-cta-after")).toHaveTextContent("₱0.00");
    expect(container.querySelector(".home-cta-after")).toHaveTextContent("Paid");
  });

  it("leaves the PAID imprint on the statement", () => {
    const { container } = mount();

    expect(container.querySelector(".home-cta-sheet .home-cta-imprint")).toHaveTextContent("Paid");
  });

  it("has one Stamp, celebrating, above the statement", () => {
    const { container } = mount();

    expect(container.querySelectorAll(".mascot")).toHaveLength(1);
    expect(container.querySelector(".home-cta-stamp .mascot")).toHaveAttribute("data-expression", "celebrating");
    expect(container.querySelector(".home-cta-sheet .mascot")).toBeNull();
  });
});
