import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageLoader } from "./page-loader";

describe("PageLoader", () => {
  it("is decorative and lets every pointer event through", () => {
    const { container } = render(<PageLoader />);
    const loader = container.firstElementChild;
    expect(loader).toHaveAttribute("aria-hidden", "true");
    expect(loader).toHaveClass("pointer-events-none");
  });

  it("is centred, above the page but below dialogs", () => {
    const { container } = render(<PageLoader />);
    expect(container.firstElementChild).toHaveClass("fixed", "grid", "place-items-center", "z-30");
  });

  it("centres in the main panel when the shell sets an inset (the desktop sidebar), else in the window", () => {
    const { container } = render(<PageLoader />);
    // Fills the window's height and everything to the right of `--page-loader-inset`, which defaults to 0.
    expect(container.firstElementChild).toHaveClass("inset-y-0", "right-0", "left-[var(--page-loader-inset,0px)]");
  });

  it("draws every face the loop uses, and TAVI", () => {
    const { container } = render(<PageLoader />);
    for (const face of ["neutral", "focus", "effort", "happy"]) {
      expect(container.querySelector(`.pl-f-${face}`), face).not.toBeNull();
    }
    expect(container.querySelector(".pl-check")).not.toBeNull();
    expect(container.querySelector(".pl-v-box path")).not.toBeNull();
    expect(container.textContent?.replace(/\s/g, "")).toBe("TAI");
  });

  it("sets the stamping station: a belt, a pile on each side and one travelling sheet that gets the imprint", () => {
    const { container } = render(<PageLoader />);
    expect(container.querySelector(".pl-belt")).not.toBeNull();
    const travelling = container.querySelector(".pl-sheet");
    expect(travelling?.querySelector(".pl-imp-pop")).not.toBeNull();
    expect(travelling?.querySelector(".pl-check")).not.toBeNull();
    // The still pile on the right is already stamped; the one on the left is blank (no imprint outside the travelling sheet).
    expect(container.querySelectorAll(".fill-primary")).toHaveLength(2);
  });

  it("keeps the Stamp in the light theme's colours in every theme", () => {
    const { container } = render(<PageLoader />);
    expect(container.querySelector(".pl-mascot")?.closest('[data-theme="light"]')).not.toBeNull();
    // The imprint takes the page's own theme, like the logo's.
    expect(container.querySelector(".pl-imp-pop")?.closest('[data-theme="light"]')).toBeNull();
  });
});
