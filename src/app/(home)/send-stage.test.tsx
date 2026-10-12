import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHANNELS, EMAIL_AT, EMAIL_LENGTH, GAP, LINK_AT, LINK_LENGTH, PDF_AT, PDF_LENGTH, TICK_MS } from "./scenes";
import { SendStage } from "./send-stage";

// "Send it the way your customers read it", alive: the email arrives and is
// opened, the PDF is drawn and its payment code scanned, and the customer's page
// is approved, in turn, while one Stamp walks from card to card. As with the
// steps above it, everything runs on fake clocks, and without a way to watch
// scrolling, or for people who asked for less motion, it is the finished
// pictures and does not move.

const CHANNEL_CARDS = [
  { title: "Email it", body: "We email the link from you.", icon: <i /> },
  { title: "A PDF for your files", body: "Download a PDF.", icon: <i /> },
  { title: "Or share the link", body: "Copy the link into a chat.", icon: <i /> },
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

const stage = () => observers.find((observer) => observer.threshold === 0.4);
const cards = () => screen.getAllByRole("listitem");
const stamp = () => document.querySelector(".mascot")!;
const play = (ticks: number) => act(() => void vi.advanceTimersByTime(ticks * TICK_MS));
const mount = () => render(<SendStage channels={CHANNEL_CARDS} documentName="Quotation" />);
function start() {
  mount();
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

describe("SendStage at rest", () => {
  it("shows the three ways to send with their finished pictures, and the Stamp pleased on the first", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    mount();

    expect(cards()).toHaveLength(3);
    expect(cards()[0]).toHaveTextContent("Email it");
    expect(cards()[0]).toHaveTextContent("View and approve");
    expect(cards()[1]).toHaveTextContent("A PDF for your files");
    expect(cards()[1]).toHaveTextContent("PDF");
    expect(cards()[1]).toHaveTextContent("₱4,500.00");
    expect(cards()[2]).toHaveTextContent("Approve");
    expect(cards()[2]).toHaveTextContent("Decline");
    expect(stamp()).toHaveAttribute("data-expression", "happy");
    expect(document.querySelectorAll(".mascot")).toHaveLength(1);
  });

  it("does not start for people who asked for less motion", () => {
    stubMedia(true);
    mount();

    expect(stage()).toBeUndefined();
    expect(cards()[0]).toHaveTextContent("View and approve");
  });
});

describe("SendStage playing", () => {
  it("starts with an empty email and fills it in from the top, ending on the button", () => {
    start();
    expect(cards()[0]).not.toHaveTextContent("sent you");
    expect(cards()[0]).not.toHaveTextContent("View and approve");

    play(EMAIL_AT.body);
    expect(cards()[0]).toHaveTextContent("sent you");
    expect(cards()[0]).not.toHaveTextContent("View and approve");

    play(EMAIL_AT.button - EMAIL_AT.body);
    expect(cards()[0]).toHaveTextContent("View and approve");
  });

  it("has the customer press the button and open the quotation", () => {
    start();
    expect(cards()[0]).not.toHaveTextContent("Opened");

    play(EMAIL_AT.opened);

    expect(cards()[0]).toHaveTextContent("Opened");
  });

  it("draws the PDF next: a blank page, then the total, its code scanned, and the page saved", () => {
    start();
    play(CHANNELS.starts[1]!);
    expect(cards()[1]).not.toHaveTextContent("₱4,500.00");
    expect(cards()[1]).not.toHaveTextContent("Scan to pay");

    play(PDF_AT.total);
    expect(cards()[1]).toHaveTextContent("₱4,500.00");

    play(PDF_AT.scanFrom - PDF_AT.total);
    expect(cards()[1]).toHaveTextContent("Scan to pay");

    play(PDF_AT.saved - PDF_AT.scanFrom);
    expect(cards()[1]).toHaveTextContent("Saved");
    expect(cards()[1]).not.toHaveTextContent("Scan to pay");
  });

  it("then has the customer approve from their phone, and tells the business", () => {
    start();
    play(CHANNELS.starts[2]!);
    expect(cards()[2]).toHaveTextContent("Approve");
    expect(cards()[2]).not.toHaveTextContent("Approved");

    play(LINK_AT.approved);
    expect(cards()[2]).toHaveTextContent("Approved");
    expect(cards()[2]).not.toHaveTextContent("approved it");

    play(LINK_AT.told - LINK_AT.approved);
    expect(cards()[2]).toHaveTextContent("Juan Dela Cruz approved it");
  });

  it("has one Stamp that follows the story: pleased, curious over the PDF, waiting on the customer, then celebrating", () => {
    start();
    expect(stamp()).toHaveAttribute("data-expression", "happy");

    play(CHANNELS.starts[1]! - GAP);
    expect(stamp()).toHaveAttribute("data-expression", "curious");

    play(CHANNELS.starts[2]! - GAP - (CHANNELS.starts[1]! - GAP));
    expect(stamp()).toHaveAttribute("data-expression", "waiting");

    play(CHANNELS.starts[2]! + LINK_AT.approved - (CHANNELS.starts[2]! - GAP));
    expect(stamp()).toHaveAttribute("data-expression", "celebrating");
    expect(document.querySelectorAll(".mascot")).toHaveLength(1);
  });

  it("lights the card the Stamp is standing on", () => {
    start();
    expect(cards()[0]).toHaveAttribute("data-lit", "true");
    expect(cards()[1]).not.toHaveAttribute("data-lit");

    play(CHANNELS.starts[1]!);

    expect(cards()[0]).not.toHaveAttribute("data-lit");
    expect(cards()[1]).toHaveAttribute("data-lit", "true");
  });

  it("goes round again after the last picture has had its moment", () => {
    start();

    play(CHANNELS.total + 4);

    expect(cards()[0]).not.toHaveTextContent("sent you");
    expect(cards()[2]).not.toHaveTextContent("Approved");
  });

  it("rests on the finished pictures, with its clock stopped, when it scrolls out of view", () => {
    start();
    play(10);

    act(() => stage()!.report(false));

    expect(cards()[0]).toHaveTextContent("View and approve");
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("SendStage under the pointer", () => {
  it("plays the card a mouse comes to, and holds on it until the mouse leaves", () => {
    start();

    fireEvent.pointerEnter(cards()[2]!, { pointerType: "mouse" });
    play(LINK_LENGTH + 80);

    expect(cards()[2]).toHaveTextContent("Juan Dela Cruz approved it");
    expect(stamp()).toHaveAttribute("data-expression", "celebrating");
    expect(cards()[2]).toHaveAttribute("data-lit", "true");

    fireEvent.pointerLeave(cards()[2]!, { pointerType: "mouse" });
    play(CHANNELS.total - CHANNELS.starts[2]! - LINK_LENGTH + 5);
    expect(cards()[2]).not.toHaveTextContent("Approved");
  });

  it("plays a card again when it is clicked or tapped", () => {
    start();
    play(CHANNELS.starts[1]! + PDF_LENGTH);
    expect(cards()[1]).toHaveTextContent("Saved");

    fireEvent.click(cards()[0]!);

    expect(cards()[0]).not.toHaveTextContent("sent you");
    expect(cards()[0]).toHaveAttribute("data-lit", "true");
    expect(EMAIL_LENGTH).toBeGreaterThan(0);
  });
});

describe("SendStage as an outbox", () => {
  const paper = () => document.querySelector(".home-send-paper")!;
  const routes = () => [...document.querySelectorAll("[data-route]")];

  it("keeps its Stamp where it is, above the cards, instead of walking it along them as the steps do", () => {
    start();
    play(CHANNELS.starts[2]!);

    expect(document.querySelector(".home-roam")).toBeNull();
    expect(document.querySelector(".home-outbox .mascot")).not.toBeNull();
  });

  it("sends a quotation from the Stamp to the first card as it starts, then to the next, then the last", () => {
    start();
    expect(paper()).toHaveAttribute("data-to", "left");
    expect(paper()).toHaveClass("home-sending");

    play(CHANNELS.starts[1]! - GAP);
    expect(paper()).toHaveAttribute("data-to", "center");

    play(CHANNELS.starts[2]! - CHANNELS.starts[1]!);
    expect(paper()).toHaveAttribute("data-to", "right");
  });

  it("presses the Stamp each time it sends", () => {
    start();

    expect(document.querySelector(".home-outbox .home-pressing")).not.toBeNull();
  });

  it("marks the route to the card it is sending to, and none while nothing moves", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    mount();
    expect(routes()).toHaveLength(3);
    expect(routes().filter((route) => route.hasAttribute("data-active"))).toHaveLength(0);
  });

  it("lights the route to the card that is playing", () => {
    start();
    expect(routes().map((route) => route.hasAttribute("data-active"))).toEqual([true, false, false]);

    play(CHANNELS.starts[1]!);

    expect(routes().map((route) => route.hasAttribute("data-active"))).toEqual([false, true, false]);
  });

  it("sends again when a card is clicked", () => {
    start();
    play(CHANNELS.starts[1]! + PDF_LENGTH);
    paper().classList.remove("home-sending");

    fireEvent.click(cards()[2]!);

    expect(paper()).toHaveAttribute("data-to", "right");
    expect(paper()).toHaveClass("home-sending");
  });
});
