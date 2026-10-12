import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Deadline } from "@/modules/organizations";
import { DeadlinesCard, whenLabel } from "./deadlines-card";

const filing: Deadline = {
  id: "2550Q:2026-10-25",
  kind: "filing",
  form: "2550Q",
  name: "Quarterly VAT return",
  dueOn: "2026-10-25",
  periodEnd: "2026-09-30",
  daysLeft: 13,
};

describe("whenLabel", () => {
  it("speaks in days", () => {
    expect(whenLabel(0)).toBe("today");
    expect(whenLabel(1)).toBe("tomorrow");
    expect(whenLabel(13)).toBe("in 13 days");
    expect(whenLabel(-1)).toBe("yesterday");
    expect(whenLabel(-30)).toBe("30 days ago");
  });
});

describe("DeadlinesCard", () => {
  it("shows the form, the period, the date and when", () => {
    render(<DeadlinesCard deadlines={[filing]} locale="en-PH" note="Check your COR." missing={null} />);
    expect(screen.getByText("2550Q")).toBeTruthy();
    expect(screen.getByText("Quarterly VAT return")).toBeTruthy();
    expect(screen.getByText(/period ending Sep 30, 2026/)).toBeTruthy();
    expect(screen.getByText("Oct 25, 2026")).toBeTruthy();
    expect(screen.getByText("in 13 days")).toBeTruthy();
    expect(screen.getByText("Check your COR.")).toBeTruthy();
  });

  it("marks a lapsed registration in words, not only colour", () => {
    const lapsed: Deadline = { ...filing, id: "r", kind: "renewal", form: null, name: "DTI business name registration expires", periodEnd: null, daysLeft: -30 };
    render(<DeadlinesCard deadlines={[lapsed]} locale="en-PH" note="n" missing={null} />);
    expect(screen.getByText(/Lapsed 30 days ago/)).toBeTruthy();
  });

  it("says what to set when there is nothing to list yet, and links there", () => {
    render(
      <DeadlinesCard deadlines={[]} locale="en-PH" note="n" missing={{ text: "Set how you're registered for tax.", href: "/settings/business" }} />,
    );
    expect(screen.getByText(/Set how you're registered/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open business profile" }).getAttribute("href")).toBe("/settings/business");
  });

  it("says so when nothing is due", () => {
    render(<DeadlinesCard deadlines={[]} locale="en-PH" note="n" missing={null} />);
    expect(screen.getByText("Nothing due in the next year.")).toBeTruthy();
  });
});
