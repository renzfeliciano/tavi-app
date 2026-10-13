import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FitPanel, fittedHeight } from "./fit-panel";

// A list's panel takes the room left in the window under whatever is above it (a notice that streams in, a
// header that wraps), so its footer is in view without scrolling the page, whatever the page has above.

describe("fittedHeight", () => {
  const size = { min: 352, max: 1024 };

  it("is what is left of the window under the panel, less the page's bottom padding", () => {
    expect(fittedHeight({ viewport: 915, top: 300, reserve: 112, ...size })).toBe(503);
  });

  it("is never shorter than a few rows, so a short window scrolls the page instead of squashing the table", () => {
    expect(fittedHeight({ viewport: 500, top: 300, reserve: 112, ...size })).toBe(352);
  });

  it("is never taller than a screenful of rows", () => {
    expect(fittedHeight({ viewport: 2400, top: 200, reserve: 48, ...size })).toBe(1024);
  });
});

describe("FitPanel", () => {
  let top = 300;
  let observed: (() => void)[] = [];

  beforeEach(() => {
    top = 300;
    observed = [];
    document.body.innerHTML = '<main id="main"><div style="padding-bottom: 112px"><div id="slot"></div></div></main>';
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 915 });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return { top: this.tagName === "SECTION" ? top : 0 } as DOMRect;
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          observed.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  const panel = () => render(<FitPanel label="Customer list" className="mt-4">rows</FitPanel>, { container: document.getElementById("slot") as HTMLElement });

  it("fits itself to the window as soon as it is on the page, and is a labelled region", () => {
    panel();

    const region = screen.getByRole("region", { name: "Customer list" });
    expect(region).toHaveClass("mt-4");
    expect(region.style.height).toBe("503px");
  });

  it("counts the part of the page that has been scrolled past", () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 100 });
    top = 200; // it is 100px higher in the window now, but just as far down the page
    panel();

    expect(screen.getByRole("region").style.height).toBe("503px");
  });

  it("refits when the window is resized", () => {
    panel();

    Object.defineProperty(window, "innerHeight", { configurable: true, value: 700 });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(screen.getByRole("region").style.height).toBe("352px");
  });

  it("refits when something above it appears or changes size, such as the email notice", () => {
    panel();
    expect(screen.getByRole("region").style.height).toBe("503px");

    top = 450; // the notice streamed in above the page header
    act(() => {
      for (const callback of observed) callback();
    });

    expect(screen.getByRole("region").style.height).toBe("353px");
  });
});
