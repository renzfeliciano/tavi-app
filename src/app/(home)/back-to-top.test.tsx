import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackToTop } from "./back-to-top";

// A way back to the top that is offered only once the end of the page has come
// into view, and goes away again when it has not.

let observers: FakeObserver[] = [];

class FakeObserver {
  disconnected = false;
  observed: Element[] = [];
  constructor(private readonly callback: IntersectionObserverCallback) {
    observers.push(this);
  }
  observe = (element: Element) => {
    this.observed.push(element);
  };
  unobserve = vi.fn();
  disconnect = () => {
    this.disconnected = true;
  };
  takeRecords = () => [];
  report(isIntersecting: boolean) {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

function renderWithEnd() {
  return render(
    <>
      <footer id="page-end">The end</footer>
      <BackToTop watch="page-end" />
    </>,
  );
}

beforeEach(() => {
  observers = [];
  vi.stubGlobal("IntersectionObserver", FakeObserver);
});
afterEach(() => vi.unstubAllGlobals());

describe("BackToTop", () => {
  it("watches the end of the page, and offers nothing until it is in view", () => {
    renderWithEnd();

    expect(observers[0]!.observed).toEqual([document.getElementById("page-end")]);
    expect(screen.queryByRole("link", { name: "Back to top" })).toBeNull();
  });

  it("offers a link back to the top once the end is in view, and takes it away when it is not", () => {
    renderWithEnd();

    act(() => observers[0]!.report(true));
    const link = screen.getByRole("link", { name: "Back to top" });
    expect(link).toHaveAttribute("href", "#top");
    expect(link).toHaveAttribute("data-shown", "true");

    act(() => observers[0]!.report(false));
    expect(screen.queryByRole("link", { name: "Back to top" })).toBeNull();
  });

  it("keeps the link out of the tab order while it is hidden", () => {
    const { container } = renderWithEnd();

    const link = container.querySelector("a")!;
    expect(link).toHaveAttribute("aria-hidden", "true");
    expect(link).toHaveAttribute("tabindex", "-1");

    act(() => observers[0]!.report(true));
    expect(link).not.toHaveAttribute("aria-hidden");
    expect(link).not.toHaveAttribute("tabindex");
  });

  it("stays hidden, and does not fail, where the browser cannot watch for scrolling", () => {
    vi.stubGlobal("IntersectionObserver", undefined);

    renderWithEnd();

    expect(screen.queryByRole("link", { name: "Back to top" })).toBeNull();
  });

  it("does not fail when the end it was told to watch is not on the page", () => {
    render(<BackToTop watch="nowhere" />);

    expect(observers).toHaveLength(0);
    expect(screen.queryByRole("link", { name: "Back to top" })).toBeNull();
  });

  it("stops watching when it leaves the page", () => {
    const { unmount } = renderWithEnd();

    unmount();

    expect(observers[0]!.disconnected).toBe(true);
  });

  it("is the Stamp that goes back up: a small happy one standing on its check, beside the words", () => {
    renderWithEnd();
    act(() => observers[0]!.report(true));

    const link = screen.getByRole("link", { name: "Back to top" });
    const stamp = link.querySelector(".mascot");
    expect(stamp).toHaveAttribute("data-expression", "happy");
    expect(stamp).toHaveAttribute("aria-hidden", "true");
    // Its check is drawn under it, so there is something for it to lift off.
    expect(stamp?.querySelector('path[d^="M23.5 79"]')).not.toBeNull();
    expect(link.querySelector("svg.lucide-arrow-up")).not.toBeNull();
  });

  it("is pulled up when it is pressed, and can be pulled again", () => {
    renderWithEnd();
    act(() => observers[0]!.report(true));
    const link = screen.getByRole("link", { name: "Back to top" });
    expect(link).not.toHaveAttribute("data-pulled");

    fireEvent.click(link);
    expect(link).toHaveAttribute("data-pulled", "true");

    link.removeAttribute("data-pulled");
    fireEvent.click(link);
    expect(link).toHaveAttribute("data-pulled", "true");
  });

  it("shows a Stamp big enough to see, not a speck beside the words", () => {
    renderWithEnd();
    act(() => observers[0]!.report(true));

    const stamp = screen.getByRole("link", { name: "Back to top" }).querySelector(".mascot")!;
    expect(Number(stamp.getAttribute("height"))).toBeGreaterThanOrEqual(44);
    // The button squeezes every icon to 1rem unless the icon names its own size; the Stamp must not be squeezed.
    expect(stamp.getAttribute("class")).toMatch(/(^|\s)size-/);
  });

  it("is ready to be pulled again once the pull has played, so it comes back playing", () => {
    renderWithEnd();
    act(() => observers[0]!.report(true));
    const link = screen.getByRole("link", { name: "Back to top" });
    const ended = (animationName: string) => {
      const event = new Event("animationend", { bubbles: true });
      Object.assign(event, { animationName });
      return event;
    };

    fireEvent.click(link);
    // The Stamp's own hop and the arrow's bob end all the time; only the flight ends the pull.
    act(() => {
      link.querySelector(".mascot")!.dispatchEvent(ended("home-top-hop"));
    });
    expect(link).toHaveAttribute("data-pulled");

    act(() => {
      link.dispatchEvent(ended("home-top-fly"));
    });
    expect(link).not.toHaveAttribute("data-pulled");
  });

  it("keeps flying when the page has scrolled away and the button is hidden under it", () => {
    renderWithEnd();
    act(() => observers[0]!.report(true));
    const link = screen.getByRole("link", { name: "Back to top" });

    fireEvent.click(link);
    // Pressing it scrolls the page up, so the end leaves the view and the button re-renders as hidden.
    act(() => observers[0]!.report(false));

    expect(link).toHaveAttribute("data-pulled", "true");
  });
});
