import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { ScheduleForm } from "./schedule-form";

const push = vi.fn();
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push }) }));

// The edit page (spec 4): when it repeats, for how long, and the terms and notes of the statements still to come.
// The items are not edited here; they stay as they were when the schedule was made.

type Update = (input: unknown) => Promise<{ ok: true } | { ok: false; errors: Record<string, string> }>;

const initial = {
  recurrence: { frequency: "monthly" as const, anchorDay: "15", anchorMonth: "11", startOn: "2026-11-15", endsOn: "", maxDrafts: "" },
  termsDays: "15",
  notes: "Thank you.",
  terms: "",
};

function renderForm(update: Update = async () => ({ ok: true })) {
  const spy = vi.fn(update);
  render(<ScheduleForm id="sch-1" initial={initial} update={spy} />);
  return spy;
}

const save = () =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  });

afterEach(() => vi.clearAllMocks());

describe("the schedule's edit form", () => {
  it("starts with what the schedule has now and says what an edit reaches", () => {
    renderForm();
    expect(screen.getByLabelText("How often")).toHaveValue("monthly");
    expect(screen.getByLabelText("Day")).toHaveValue("15");
    expect(screen.getByLabelText("Next statement on")).toHaveValue("2026-11-15");
    expect(screen.getByLabelText("Days to pay")).toHaveValue("15");
    expect(screen.getByLabelText(/^Notes/)).toHaveValue("Thank you.");
    expect(screen.getByLabelText(/^Notes/)).toHaveAttribute("placeholder", expect.stringMatching(/^e\.g\. /));
    expect(screen.getByLabelText(/^Terms/)).toHaveAttribute("placeholder", expect.stringMatching(/^e\.g\. /));
    expect(screen.getByText("Applies to the next statement onward.")).toBeInTheDocument();
  });

  it("sends the timing, end rule, terms and notes", async () => {
    const update = renderForm();
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Days to pay"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText(/^Terms/), { target: { value: "Pay by bank transfer." } });
    await save();
    expect(update).toHaveBeenCalledWith({
      frequency: "monthly",
      anchorDay: "20",
      anchorMonth: "",
      startOn: "2026-11-15",
      endsOn: "",
      maxDrafts: "",
      termsDays: "30",
      notes: "Thank you.",
      terms: "Pay by bank transfer.",
    });
    expect(toast.success).toHaveBeenCalledWith("Schedule updated. It applies to the next statement onward.");
    expect(push).toHaveBeenCalledWith("/recurring/sch-1");
  });

  it("shows a problem next to its field and stays on the page", async () => {
    renderForm(async () => ({ ok: false, errors: { termsDays: "Choose between 0 and 365 days." } }));
    await save();
    expect(screen.getByText("Choose between 0 and 365 days.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
