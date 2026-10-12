import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RestStage } from "./rest-stage";

// "And the rest of the job", with a Stamp that is asleep until someone looks.
// It rests with its Zs; a pointer over the rows wakes it (curious), and it dozes
// off again a moment after the pointer stops or leaves. Pressing it startles it
// (concerned, with a jolt), and it settles back down.

const ROWS = [
  { title: "Downpayments and part-payments", body: "Record each payment.", icon: <i />, picture: <span data-testid="picture-0" /> },
  { title: "Scan to pay", body: "Add your payment QR codes.", icon: <i />, picture: <span data-testid="picture-1" /> },
  { title: "A recycle bin", body: "Bring it back.", icon: <i />, picture: <span data-testid="picture-2" /> },
];

const stamp = () => document.querySelector(".mascot")!;
const mount = () => render(<RestStage title="And the rest of the job" intro="What happens after it goes out." rows={ROWS} feed={<div data-testid="feed" />} className="grid" />);
const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("RestStage", () => {
  it("shows the heading, the intro, every row with its picture, and one sleeping Stamp", () => {
    mount();

    expect(screen.getByRole("heading", { level: 2, name: "And the rest of the job" })).toBeInTheDocument();
    expect(screen.getByText("What happens after it goes out.")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("heading", { level: 3, name: "Scan to pay" })).toBeInTheDocument();
    expect(screen.getByTestId("picture-1")).toBeInTheDocument();
    expect(document.querySelectorAll(".mascot")).toHaveLength(1);
    expect(stamp()).toHaveAttribute("data-expression", "resting");
    expect(stamp()).toHaveAttribute("aria-hidden", "true");
  });

  it("perches the Stamp on the activity card that fills the column under the heading", () => {
    mount();

    const feed = screen.getByTestId("feed");
    expect(feed.parentElement).toContainElement(stamp() as HTMLElement);
  });

  it("wakes, curious, when a pointer comes over the rows", () => {
    mount();

    fireEvent.pointerEnter(screen.getByRole("list"), { pointerType: "mouse" });

    expect(stamp()).toHaveAttribute("data-expression", "curious");
  });

  it("dozes off again a moment after the pointer leaves", () => {
    mount();
    fireEvent.pointerEnter(screen.getByRole("list"), { pointerType: "mouse" });
    fireEvent.pointerLeave(screen.getByRole("list"), { pointerType: "mouse" });

    wait(1000);
    expect(stamp()).toHaveAttribute("data-expression", "curious");

    wait(800);
    expect(stamp()).toHaveAttribute("data-expression", "resting");
  });

  it("stays awake while the pointer keeps moving over the rows", () => {
    mount();
    const list = screen.getByRole("list");
    fireEvent.pointerEnter(list, { pointerType: "mouse" });

    for (let i = 0; i < 4; i += 1) {
      wait(1200);
      fireEvent.pointerMove(list, { pointerType: "mouse" });
    }

    expect(stamp()).toHaveAttribute("data-expression", "curious");
  });

  it("is startled when it is pressed, jolts, and settles back to sleep", () => {
    mount();

    fireEvent.pointerDown(stamp());

    expect(stamp()).toHaveAttribute("data-expression", "concerned");
    expect(document.querySelector(".home-startle")).not.toBeNull();

    wait(1600);
    expect(stamp()).toHaveAttribute("data-expression", "resting");
  });

  it("goes back to watching, not sleeping, if the pointer is still over the rows after a startle", () => {
    mount();
    fireEvent.pointerEnter(screen.getByRole("list"), { pointerType: "mouse" });
    fireEvent.pointerDown(stamp());

    wait(1600);

    expect(stamp()).toHaveAttribute("data-expression", "curious");
  });

  it("stops its timers when it leaves the page", () => {
    const { unmount } = mount();
    fireEvent.pointerEnter(screen.getByRole("list"), { pointerType: "mouse" });
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
