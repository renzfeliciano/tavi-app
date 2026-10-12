import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrandMascot, MASCOT_EXPRESSIONS } from "./brand-mascot";

function mockReducedMotion(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: reduced,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
}

beforeEach(() => {
  // Run the pointer handler's animation frame at once.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(() => vi.unstubAllGlobals());

describe("BrandMascot", () => {
  it("is hidden from assistive technology when decorative", () => {
    const { container } = render(<BrandMascot />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("is announced as an image when given a label", () => {
    render(<BrandMascot label="Stamp, celebrating" expression="celebrating" />);
    expect(screen.getByRole("img", { name: "Stamp, celebrating" })).toBeInTheDocument();
  });

  it("draws the check imprint under a happy Stamp by default", () => {
    const { container } = render(<BrandMascot expression="happy" size="md" />);
    const svg = container.querySelector("svg")!;
    expect(svg.querySelector('path[d^="M23.5 79"]')).not.toBeNull();
    expect(svg).toHaveAttribute("viewBox", "-2 0 72 88");
    expect(svg).toHaveAttribute("height", "56");
  });

  it("leaves the imprint out and trims the space under the pad when asked", () => {
    const { container } = render(<BrandMascot expression="happy" size="md" imprint={false} />);
    const svg = container.querySelector("svg")!;
    expect(svg.querySelector('path[d^="M23.5 79"]')).toBeNull();
    expect(svg).toHaveAttribute("viewBox", "-2 0 72 74");
    // Same scale as the full drawing: the width does not change.
    expect(Number(svg.getAttribute("width"))).toBeCloseTo(56 * (72 / 88));
    expect(Number(svg.getAttribute("height"))).toBeCloseTo(56 * (74 / 88));
  });

  it.each(MASCOT_EXPRESSIONS)("renders the %s expression", (expression) => {
    const { container } = render(<BrandMascot expression={expression} />);
    expect(container.querySelector("svg")).toHaveAttribute("data-expression", expression);
  });

  it("only plays the press moment when asked to", () => {
    const { container, rerender } = render(<BrandMascot />);
    expect(container.querySelector("svg")).not.toHaveAttribute("data-animated");
    rerender(<BrandMascot animated />);
    expect(container.querySelector("svg")).toHaveAttribute("data-animated", "true");
  });

  it("idles (blinks, breathes) by default and can be held still", () => {
    const { container, rerender } = render(<BrandMascot />);
    expect(container.querySelector("svg")).toHaveAttribute("data-idle", "true");
    rerender(<BrandMascot idle={false} />);
    expect(container.querySelector("svg")).not.toHaveAttribute("data-idle");
  });

  it("does not blink while resting or celebrating", () => {
    const { container } = render(<BrandMascot expression="resting" />);
    expect(container.querySelector(".mascot-blink")).toBeNull();
  });

  it("looks toward the pointer", () => {
    mockReducedMotion(false);
    const { container } = render(<BrandMascot size="lg" />);
    const svg = container.querySelector("svg")!;
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 70, height: 88, right: 70, bottom: 88 }) as DOMRect;
    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 600, clientY: 30 }));
    });
    expect(Number(svg.style.getPropertyValue("--look-x"))).toBeGreaterThan(0);
  });

  it("keeps still when the person prefers reduced motion", () => {
    mockReducedMotion(true);
    const { container } = render(<BrandMascot size="lg" />);
    const svg = container.querySelector("svg")!;
    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 600, clientY: 30 }));
    });
    expect(svg.style.getPropertyValue("--look-x")).toBe("");
  });

  it("does not follow the pointer at small sizes", () => {
    mockReducedMotion(false);
    const { container } = render(<BrandMascot size="xs" />);
    const svg = container.querySelector("svg")!;
    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 600, clientY: 30 }));
    });
    expect(svg.style.getPropertyValue("--look-x")).toBe("");
  });
});
