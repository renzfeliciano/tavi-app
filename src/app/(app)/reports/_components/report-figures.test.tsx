import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Compared, Figures } from "./report-figures";

const items = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ label: `Figure ${i + 1}`, value: `₱${i + 1}.00` }));

const grid = () => screen.getByText("Figure 1").closest("dl") as HTMLElement;
const tile = (n: number) => screen.getByText(`Figure ${n}`).closest("div") as HTMLElement;

describe("Figures", () => {
  it.each([
    [1, "sm:grid-cols-1"],
    [2, "sm:grid-cols-2"],
    [3, "sm:grid-cols-3"],
    [4, "sm:grid-cols-2"],
    [6, "sm:grid-cols-3"],
  ])("lays %i figures out so no grey cell is left over", (count, columns) => {
    render(<Figures items={items(count)} currency={null} />);
    expect(grid()).toHaveClass(columns);
    for (let n = 1; n <= count; n++) expect(tile(n)).not.toHaveClass("sm:col-span-2", "sm:col-span-3");
  });

  it("lets the last figure fill the row when the count doesn't divide into columns", () => {
    render(<Figures items={items(5)} currency={null} />);
    expect(grid()).toHaveClass("sm:grid-cols-3");
    expect(tile(5)).toHaveClass("sm:col-span-2");
    expect(tile(4)).not.toHaveClass("sm:col-span-2");
  });

  it("names the currency beside each label when there are several", () => {
    render(<Figures items={items(1)} currency="USD" />);
    expect(screen.getByText("Figure 1 (USD)")).toBeInTheDocument();
  });
});

describe("Compared", () => {
  const money = (minor: number) => `₱${minor / 100}`;
  const compare = (now: number, before: number) =>
    render(<Compared now={now} before={before} format={money} label="the month before" />).container;

  it("says nothing when neither period has anything", () => {
    expect(compare(0, 0)).toBeEmptyDOMElement();
  });

  it("says there's nothing to compare with when the earlier period was empty", () => {
    expect(compare(50_000, 0)).toHaveTextContent("Nothing in the month before to compare with.");
  });

  it("says when it's the same", () => {
    expect(compare(50_000, 50_000)).toHaveTextContent("Same as the month before: ₱500.");
  });

  it("gives a percentage for modest changes", () => {
    expect(compare(145_000, 100_000)).toHaveTextContent("Up 45% from the month before: ₱1000 then.");
    expect(compare(80_000, 100_000)).toHaveTextContent("Down 20% from the month before: ₱1000 then.");
  });

  it("gives a multiple once it is at least double, not a percentage in the thousands", () => {
    expect(compare(240_000, 100_000)).toHaveTextContent("2.4 times the month before: ₱1000 then.");
    expect(compare(300_000, 100_000)).toHaveTextContent("3 times the month before: ₱1000 then.");
  });

  it("doesn't print an absurd figure when the earlier period was tiny", () => {
    const text = compare(12_800_000, 80_000).textContent;
    expect(text).toBe("More than ten times the month before: ₱800 then.");
    expect(text).not.toMatch(/\d{3,}%/);
  });
});
