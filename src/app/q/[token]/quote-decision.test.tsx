import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuoteDecision } from "./quote-decision";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("./actions", () => ({ decideQuoteAction: vi.fn() }));

const decision = () =>
  render(<QuoteDecision token="t" contentHash="h" name="Quotation QUO-000001" businessName="Santos Aircon" nameExample="Juan Dela Cruz" />);

describe("the customer's approve and decline boxes", () => {
  it("shows what to type for the approver's name", () => {
    decision();

    fireEvent.click(screen.getByRole("button", { name: /Approve quote/ }));

    expect(screen.getByLabelText("Your name")).toHaveAttribute("placeholder", "e.g. Juan Dela Cruz");
  });

  it("shows what a decline reason might say", () => {
    decision();

    fireEvent.click(screen.getByRole("button", { name: /Decline/ }));

    expect(screen.getByLabelText(/^Reason/)).toHaveAttribute("placeholder", expect.stringMatching(/^e\.g\. /));
  });
});
