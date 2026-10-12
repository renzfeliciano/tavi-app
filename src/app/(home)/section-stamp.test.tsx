import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SectionStamp } from "./section-stamp";

// The Stamp that keeps each section of the home company: alive (it blinks and
// breathes and its eyes follow the pointer, all from BrandMascot) and pressed
// once, when its section first scrolls into view.

let observers: FakeObserver[] = [];

class FakeObserver {
  disconnected = false;
  constructor(private readonly callback: IntersectionObserverCallback) {
    observers.push(this);
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = () => {
    this.disconnected = true;
  };
  takeRecords = () => [];
  report(isIntersecting: boolean) {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

beforeEach(() => {
  observers = [];
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => vi.unstubAllGlobals());

describe("SectionStamp", () => {
  it("draws the Stamp in the mood it is given, as decoration", () => {
    const { container } = render(<SectionStamp expression="curious" />);

    const stamp = container.querySelector(".mascot")!;
    expect(stamp).toHaveAttribute("data-expression", "curious");
    expect(stamp).toHaveAttribute("aria-hidden", "true");
  });

  it("stays alive: it blinks and breathes while idle", () => {
    const { container } = render(<SectionStamp expression="happy" />);

    expect(container.querySelector(".mascot")).toHaveAttribute("data-idle", "true");
  });

  it("holds its press until the section is in view, then presses once", () => {
    const { container } = render(<SectionStamp expression="happy" />);
    const stamp = container.querySelector(".mascot")!;
    expect(stamp).not.toHaveAttribute("data-animated");

    act(() => observers[0]!.report(false));
    expect(stamp).not.toHaveAttribute("data-animated");

    act(() => observers[0]!.report(true));
    expect(stamp).toHaveAttribute("data-animated", "true");
    expect(observers[0]!.disconnected).toBe(true);
  });

  it("draws a still Stamp, and does not fail, where the browser cannot watch for scrolling", () => {
    vi.stubGlobal("IntersectionObserver", undefined);

    const { container } = render(<SectionStamp expression="resting" />);

    const stamp = container.querySelector(".mascot")!;
    expect(stamp).toHaveAttribute("data-expression", "resting");
    expect(stamp).not.toHaveAttribute("data-animated");
  });

  it("can sit on a light chip, for a coloured band where its ink body would be lost", () => {
    const plain = render(<SectionStamp expression="neutral" />);
    expect(plain.container.querySelector('div[data-theme="light"] .mascot')).toBeNull();
    plain.unmount();

    const { container } = render(<SectionStamp expression="neutral" chip />);
    expect(container.querySelector('div[data-theme="light"] .mascot')).not.toBeNull();
  });

  it("takes the class it is given, to size and place it", () => {
    const { container } = render(<SectionStamp expression="happy" className="w-14" />);

    expect(container.querySelector(".mascot")).toHaveClass("w-14");
  });
});
