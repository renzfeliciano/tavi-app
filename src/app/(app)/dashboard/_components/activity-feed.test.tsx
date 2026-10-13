import { render, screen } from "@testing-library/react";
import type { Route } from "next";
import { describe, expect, it } from "vitest";
import type { DayGroup } from "../_lib/group-by-day";
import { type FeedEntry, ActivityFeed } from "./activity-feed";

const entry = (id: string, over: Partial<FeedEntry> = {}): FeedEntry => ({
  id,
  text: "Quotation QUO-000001 sent",
  href: "/quotes/q1" as Route,
  kind: "sent",
  createdAt: new Date("2026-10-12T06:14:00Z"),
  ...over,
});
const group = (label: string, day: string, ...items: FeedEntry[]): DayGroup<FeedEntry> => ({ day, label, items });
const feed = (groups: DayGroup<FeedEntry>[]) => render(<ActivityFeed groups={groups} locale="en-PH" timeZone="Asia/Manila" />);

describe("ActivityFeed", () => {
  it("is titled, with each day under its own heading", () => {
    feed([group("Today", "2026-10-12", entry("a")), group("Yesterday", "2026-10-11", entry("b"))]);

    expect(screen.getByRole("heading", { level: 2, name: "Recent activity" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Yesterday" })).toBeInTheDocument();
  });

  it("links what happened to the record it happened on", () => {
    feed([group("Today", "2026-10-12", entry("a"))]);

    expect(screen.getByRole("link", { name: "Quotation QUO-000001 sent" })).toHaveAttribute("href", "/quotes/q1");
  });

  it("keeps an entry with no record as plain text", () => {
    feed([group("Today", "2026-10-12", entry("a", { href: null, text: "Payment REC-000001 recorded on Billing statement INV-000001" }))]);

    expect(screen.getByText("Payment REC-000001 recorded on Billing statement INV-000001")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("gives the time of day where the business is, with the exact moment for machines", () => {
    feed([group("Today", "2026-10-12", entry("a"))]);
    const time = screen.getByText(/2:14/);

    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", "2026-10-12T06:14:00.000Z");
    expect(time.textContent).toMatch(/^2:14\s?[ap]m$/i);
  });

  it("draws a mark for what kind of event it was, hidden from screen readers", () => {
    feed([group("Today", "2026-10-12", entry("a", { kind: "approved" }), entry("b", { kind: "declined" }))]);
    const rows = screen.getAllByRole("listitem");

    const mark = (row: HTMLElement | undefined) => row?.querySelector('[data-slot="activity-mark"]');

    for (const row of rows) expect(mark(row)).toHaveAttribute("aria-hidden", "true");
    expect(mark(rows[0])).toHaveAttribute("data-kind", "approved");
    expect(mark(rows[1])).toHaveAttribute("data-kind", "declined");
  });

  it("says what shows up here when there is nothing yet", () => {
    feed([]);

    expect(screen.getByText(/Nothing yet/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
  });
});
