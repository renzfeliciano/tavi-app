import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgingBar, type AgingSlice } from "./aging-bar";

const slices: AgingSlice[] = [
  { key: "current", label: "Not yet due", amountMinor: 50_000 },
  { key: "1-30", label: "1–30 days overdue", amountMinor: 30_000 },
  { key: "31-60", label: "31–60 days overdue", amountMinor: 0 },
  { key: "61-90", label: "61–90 days overdue", amountMinor: 10_000 },
  { key: "over-90", label: "Over 90 days overdue", amountMinor: 10_000 },
];

const props = { slices, currency: "PHP", locale: "en-PH" };

describe("AgingBar", () => {
  it("draws one picture that says each age's share of what is outstanding", () => {
    render(<AgingBar {...props} />);
    const bar = screen.getByRole("img");
    expect(bar).toHaveAccessibleName(
      "Outstanding by age: not yet due 50%, 1–30 days overdue 30%, 61–90 days overdue 10%, over 90 days overdue 10%",
    );
  });

  it("sizes each segment by its share and leaves out the empty ages", () => {
    const { container } = render(<AgingBar {...props} />);
    const segments = Array.from(container.querySelectorAll<HTMLElement>("[data-segment]"));
    expect(segments.map((s) => s.dataset.segment)).toEqual(["current", "1-30", "61-90", "over-90"]);
    expect(segments.map((s) => s.style.width)).toEqual(["50%", "30%", "10%", "10%"]);
  });

  it("lists every age in a legend with its amount and share, including the empty ones", () => {
    render(<AgingBar {...props} />);
    const legend = screen.getByRole("list", { name: "Outstanding by age" });
    const items = within(legend).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent("Not yet due");
    expect(items[0]).toHaveTextContent("₱500.00");
    expect(items[0]).toHaveTextContent("50%");
    expect(items[2]).toHaveTextContent("31–60 days overdue");
    expect(items[2]).toHaveTextContent("₱0.00");
    expect(items[2]).toHaveTextContent("0%");
  });

  it("keeps a small share visible and rounds shares to whole percents", () => {
    render(
      <AgingBar
        {...props}
        slices={[
          { key: "current", label: "Not yet due", amountMinor: 99_900 },
          { key: "1-30", label: "1–30 days overdue", amountMinor: 100 },
        ]}
      />,
    );
    const items = within(screen.getByRole("list", { name: "Outstanding by age" })).getAllByRole("listitem");
    expect(items[1]).toHaveTextContent("<1%");
    const small = document.querySelector<HTMLElement>('[data-segment="1-30"]');
    expect(Number.parseFloat(small?.style.width ?? "0")).toBeGreaterThanOrEqual(1);
  });

  it("draws nothing when nothing is outstanding", () => {
    const { container } = render(<AgingBar {...props} slices={slices.map((s) => ({ ...s, amountMinor: 0 }))} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("never uses a raw colour", () => {
    const { container } = render(<AgingBar {...props} />);
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|oklch\(/i);
  });
});
