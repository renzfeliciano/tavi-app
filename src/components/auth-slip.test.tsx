import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthSlip } from "./auth-slip";

describe("AuthSlip", () => {
  it("is headed with what it shows: a job from quote to paid", () => {
    render(<AuthSlip />);
    expect(screen.getByText("From quote to paid")).toBeInTheDocument();
  });

  it("lists the three moments of a job in order, each with how it ends", () => {
    render(<AuthSlip />);
    const steps = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(steps.map((s) => s.textContent)).toEqual(["1Quoteapproved", "2Invoicesent", "Paymentrecorded"]);
  });

  it("puts the check on the last moment only, since that is the point of the job", () => {
    render(<AuthSlip />);
    const steps = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(steps.map((s) => s.querySelector("svg") !== null)).toEqual([false, false, true]);
  });

  it("is a sheet in the design's tokens, with nothing that moves", () => {
    const { container } = render(<AuthSlip />);
    const slip = container.firstElementChild as HTMLElement;
    expect(slip.className).toContain("bg-card");
    expect(slip.className).toContain("border-border");
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,6}\b|gradient|animate-|transition/);
  });
});
