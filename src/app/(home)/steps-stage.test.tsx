import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GAP, MAKE_LENGTH, PAY_AT, PAY_LENGTH, SEND_AT, STARTS, TICK_MS, TIMELINE_LENGTH } from "./scenes";
import { StepsStage } from "./steps-stage";

// "From job to paid in three steps", alive: the three pictures play in turn as
// little scenes while one Stamp hops from card to card. Everything here runs
// on fake clocks. Without a way to watch scrolling, or for people who asked
// for less motion, the page is the finished pictures and does not move.

const STEPS = [
  { title: "Make the quotation", body: "Pick a customer." },
  { title: "Send it as a link", body: "Share it." },
  { title: "Get paid", body: "Record each payment." },
];

let observers: FakeObserver[] = [];

class FakeObserver {
  disconnected = false;
  threshold: number | undefined;
  constructor(
    private readonly callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.threshold = options?.threshold as number | undefined;
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

function stubMedia(reducedMotion = false) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: query.includes("reduce") ? reducedMotion : false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
}

/** The stage's own watcher (the Stamp has one of its own, for its press). */
const stage = () => observers.find((observer) => observer.threshold === 0.4);
const cards = () => screen.getAllByRole("listitem");
/** The text is somewhere in the card (the Paid badge and the Paid imprint both say it). */
const says = (card: HTMLElement, text: string) => within(card).queryAllByText(text).length > 0;
const stamp = () => document.querySelector(".mascot")!;
/** Let the clock run this many ticks. */
const play = (ticks: number) => act(() => void vi.advanceTimersByTime(ticks * TICK_MS));
/** Scroll it into view and let the first scene begin. */
function start() {
  render(<StepsStage steps={STEPS} />);
  act(() => stage()!.report(true));
}

beforeEach(() => {
  observers = [];
  vi.useFakeTimers();
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  stubMedia();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("StepsStage at rest", () => {
  it("shows the three steps with their finished pictures, and the Stamp curious on the first card", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<StepsStage steps={STEPS} />);

    expect(cards()).toHaveLength(3);
    expect(cards()[0]).toHaveTextContent("Make the quotation");
    expect(cards()[0]).toHaveTextContent("Appliance repair");
    expect(cards()[0]).toHaveTextContent("₱4,500.00");
    expect(cards()[1]).toHaveTextContent("Email it");
    expect(cards()[1]).toHaveTextContent("Copy link");
    expect(cards()[2]).toHaveTextContent("Downpayment");
    expect(cards()[2]).toHaveTextContent("Balance");
    expect(stamp()).toHaveAttribute("data-expression", "curious");
    expect(document.querySelectorAll(".mascot")).toHaveLength(1);
  });

  it("numbers the first two steps and ends on the check, as before", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<StepsStage steps={STEPS} />);

    expect(cards()[0]!.querySelector("svg.lucide-check")).toBeNull();
    expect(cards()[1]!.querySelector("svg.lucide-check")).toBeNull();
    expect(cards()[2]!.querySelector("svg.lucide-check")).not.toBeNull();
  });

  it("does not start for people who asked for less motion", () => {
    stubMedia(true);
    render(<StepsStage steps={STEPS} />);

    expect(stage()).toBeUndefined();
    expect(cards()[0]).toHaveTextContent("Appliance repair");
  });
});

describe("StepsStage playing", () => {
  it("starts over from empty pictures when it scrolls into view, and fills the quotation in as if typed", () => {
    start();

    expect(cards()[0]).not.toHaveTextContent("Appliance repair");
    expect(cards()[0]).toHaveTextContent("₱0.00");
    play(5);
    expect(cards()[0]).toHaveTextContent("Appli");
    expect(cards()[0]).not.toHaveTextContent("Appliance");
  });

  it("counts the total up as the prices go in", () => {
    start();

    play(MAKE_LENGTH);

    expect(cards()[0]).toHaveTextContent("Appliance repair");
    expect(cards()[0]).toHaveTextContent("Check-up and labour");
    expect(cards()[0]).toHaveTextContent("₱4,500.00");
  });

  it("ticks a step off with a check once its scene is done", () => {
    start();
    expect(cards()[0]!.querySelector("svg.lucide-check")).toBeNull();

    play(MAKE_LENGTH);

    expect(cards()[0]!.querySelector("svg.lucide-check")).not.toBeNull();
  });

  it("sends it next: Email it is pressed, the status turns to Sent, then the link is copied", () => {
    start();
    play(STARTS[1]);
    expect(says(cards()[1]!, "Draft")).toBe(true);

    play(SEND_AT.sent);
    expect(says(cards()[1]!, "Sent")).toBe(true);
    expect(cards()[1]).toHaveTextContent("Emailed to Juan Dela Cruz");

    play(SEND_AT.copied - SEND_AT.sent);
    expect(cards()[1]).toHaveTextContent("Copied");
  });

  it("then records the downpayment and the balance, and ends on Paid", () => {
    start();
    play(STARTS[2]);
    expect(says(cards()[2]!, "Unpaid")).toBe(true);

    play(PAY_AT.commit1 + 10);
    expect(says(cards()[2]!, "Partially paid")).toBe(true);
    expect(cards()[2]).toHaveTextContent("Downpayment");

    play(PAY_LENGTH - PAY_AT.commit1 - 10);
    expect(says(cards()[2]!, "Paid")).toBe(true);
    expect(cards()[2]).toHaveTextContent("₱0.00");
  });

  it("has one Stamp that follows the story: curious, then pleased, then celebrating", () => {
    start();
    expect(stamp()).toHaveAttribute("data-expression", "curious");

    play(STARTS[1] - GAP);
    expect(stamp()).toHaveAttribute("data-expression", "happy");

    play(STARTS[2] + PAY_AT.commit2 - (STARTS[1] - GAP));
    expect(stamp()).toHaveAttribute("data-expression", "celebrating");
    expect(document.querySelectorAll(".mascot")).toHaveLength(1);
  });

  it("lights the card the Stamp is standing on", () => {
    start();
    expect(cards()[0]).toHaveAttribute("data-lit", "true");
    expect(cards()[1]).not.toHaveAttribute("data-lit");

    play(STARTS[1]);

    expect(cards()[0]).not.toHaveAttribute("data-lit");
    expect(cards()[1]).toHaveAttribute("data-lit", "true");
  });

  it("goes round again after the last picture has had its moment", () => {
    start();

    play(TIMELINE_LENGTH + 4);

    expect(cards()[0]).toHaveTextContent("₱0.00");
    expect(says(cards()[2]!, "Unpaid")).toBe(true);
  });

  it("rests on the finished pictures, with its clock stopped, when it scrolls out of view", () => {
    start();
    play(20);

    act(() => stage()!.report(false));

    expect(cards()[0]).toHaveTextContent("Appliance repair");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops its clock when it leaves the page", () => {
    const { unmount } = render(<StepsStage steps={STEPS} />);
    act(() => stage()!.report(true));
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("StepsStage under the pointer", () => {
  it("plays the card a mouse comes to, and holds on it until the mouse leaves", () => {
    start();

    fireEvent.pointerEnter(cards()[2]!, { pointerType: "mouse" });
    play(PAY_LENGTH + 80);

    expect(says(cards()[2]!, "Paid")).toBe(true);
    expect(stamp()).toHaveAttribute("data-expression", "celebrating");
    expect(cards()[2]).toHaveAttribute("data-lit", "true");

    // Let go, and it carries on: after its pause it goes round again.
    fireEvent.pointerLeave(cards()[2]!, { pointerType: "mouse" });
    play(TIMELINE_LENGTH - STARTS[2] - PAY_LENGTH + 5);
    expect(says(cards()[2]!, "Unpaid")).toBe(true);
  });

  it("does not hold a step for a finger, which lifts as soon as it has touched", () => {
    start();

    fireEvent.pointerEnter(cards()[2]!, { pointerType: "touch" });
    play(10);

    expect(cards()[0]).toHaveAttribute("data-lit", "true");
  });

  it("plays a step again when it is clicked or tapped", () => {
    start();
    play(STARTS[2] + PAY_LENGTH);
    expect(says(cards()[2]!, "Paid")).toBe(true);

    fireEvent.click(cards()[1]!);

    expect(says(cards()[1]!, "Draft")).toBe(true);
    expect(cards()[1]).toHaveAttribute("data-lit", "true");
  });
});
