import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HoverStage } from "./hover-stage";

// The stage tells the page's CSS where the pointer is, as two numbers from -1
// to 1 across the window (--mx, --my). Only a fine pointer that has not asked
// for less motion gets this; a phone or a reduced-motion setting gets a page
// that holds still under the finger.

function stubMedia({ finePointer = true, reducedMotion = false } = {}) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("reduce") ? reducedMotion : query.includes("pointer: fine") ? finePointer : false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function pointerAt(clientX: number, clientY: number) {
  act(() => {
    window.dispatchEvent(new MouseEvent("pointermove", { clientX, clientY }));
  });
}

beforeEach(() => {
  // Run the throttled frame at once.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(() => vi.unstubAllGlobals());

describe("HoverStage", () => {
  it("renders its children inside an element with the class it is given", () => {
    stubMedia();
    const { container } = render(
      <HoverStage className="home-stage">
        <p>Inside</p>
      </HoverStage>,
    );

    const root = container.firstElementChild!;
    expect(root).toHaveClass("home-stage");
    expect(root).toHaveTextContent("Inside");
  });

  it("reports the pointer from -1 to 1 across the window, on its own element", () => {
    stubMedia();
    const { container } = render(<HoverStage>x</HoverStage>);
    const root = container.firstElementChild as HTMLElement;
    const { innerWidth: w, innerHeight: h } = window;

    pointerAt(0, 0);
    expect(root.style.getPropertyValue("--mx")).toBe("-1");
    expect(root.style.getPropertyValue("--my")).toBe("-1");

    pointerAt(w, h);
    expect(root.style.getPropertyValue("--mx")).toBe("1");
    expect(root.style.getPropertyValue("--my")).toBe("1");

    pointerAt(w * 0.75, h / 2);
    expect(root.style.getPropertyValue("--mx")).toBe("0.5");
    expect(root.style.getPropertyValue("--my")).toBe("0");
  });

  it("goes back to the middle when the pointer leaves the window", () => {
    stubMedia();
    const { container } = render(<HoverStage>x</HoverStage>);
    const root = container.firstElementChild as HTMLElement;

    pointerAt(0, 0);
    act(() => {
      document.documentElement.dispatchEvent(new Event("pointerleave"));
    });

    expect(root.style.getPropertyValue("--mx")).toBe("0");
    expect(root.style.getPropertyValue("--my")).toBe("0");
  });

  it("holds still for people who asked for less motion", () => {
    stubMedia({ reducedMotion: true });
    const { container } = render(<HoverStage>x</HoverStage>);

    pointerAt(0, 0);

    expect((container.firstElementChild as HTMLElement).style.getPropertyValue("--mx")).toBe("");
  });

  it("holds still on a touch screen, where there is no hovering pointer", () => {
    stubMedia({ finePointer: false });
    const { container } = render(<HoverStage>x</HoverStage>);

    pointerAt(0, 0);

    expect((container.firstElementChild as HTMLElement).style.getPropertyValue("--mx")).toBe("");
  });

  it("stops listening when it leaves the page", () => {
    stubMedia();
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<HoverStage>x</HoverStage>);

    unmount();

    expect(remove).toHaveBeenCalledWith("pointermove", expect.any(Function));
    remove.mockRestore();
  });
});
