import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { RepeatDialog } from "./repeat-dialog";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

// "Repeat this" on an issued bill (spec 3): how often, which day, when it starts, and an optional end.

type Create = (input: unknown) => Promise<{ ok: true; id: string } | { ok: false; errors: Record<string, string> }>;

function renderDialog(create: Create = async () => ({ ok: true, id: "sch-1" })) {
  const spy = vi.fn(create);
  render(<RepeatDialog create={spy} defaults={{ startOn: "2026-11-01" }} locale="en-PH" />);
  return spy;
}

async function open() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Repeat this" }));
  });
}

afterEach(() => vi.clearAllMocks());

describe("the Repeat dialog", () => {
  it("opens from a Repeat this button with the fields to fill", async () => {
    renderDialog();
    await open();
    expect(screen.getByLabelText("How often")).toBeInTheDocument();
    expect(screen.getByLabelText("Day")).toBeInTheDocument();
    expect(screen.getByLabelText("Starts on")).toHaveValue("2026-11-01");
    expect(screen.getByLabelText(/Ends on/)).toBeInTheDocument();
    const count = screen.getByLabelText(/Number of statements/);
    expect(count).toHaveAttribute("placeholder", expect.stringMatching(/^e\.g\. /));
    expect(screen.queryByLabelText("Month")).not.toBeInTheDocument();
  });

  it("offers weekday names for a weekly schedule and a month for a yearly one", async () => {
    renderDialog();
    await open();
    fireEvent.change(screen.getByLabelText("How often"), { target: { value: "weekly" } });
    expect(screen.getByRole("option", { name: "Monday" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "31st" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("How often"), { target: { value: "yearly" } });
    expect(screen.getByLabelText("Month")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "31st" })).toBeInTheDocument();
  });

  it("sends the chosen values to the action", async () => {
    const create = renderDialog();
    await open();
    fireEvent.change(screen.getByLabelText("How often"), { target: { value: "quarterly" } });
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "15" } });
    fireEvent.change(screen.getByLabelText("Starts on"), { target: { value: "2026-11-10" } });
    fireEvent.change(screen.getByLabelText(/Ends on/), { target: { value: "2027-12-31" } });
    fireEvent.change(screen.getByLabelText(/Number of statements/), { target: { value: "6" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start repeating" }));
    });
    expect(create).toHaveBeenCalledWith({
      frequency: "quarterly",
      anchorDay: "15",
      anchorMonth: "",
      startOn: "2026-11-10",
      endsOn: "2027-12-31",
      maxDrafts: "6",
    });
  });

  it("shows a problem next to its field and keeps the values", async () => {
    renderDialog(async () => ({ ok: false, errors: { startOn: "Choose a start date from today on." } }));
    await open();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start repeating" }));
    });
    expect(screen.getByText("Choose a start date from today on.")).toBeInTheDocument();
    expect(screen.getByLabelText("Starts on")).toHaveValue("2026-11-01");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("says what was set up, with a link to the schedule", async () => {
    renderDialog();
    await open();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start repeating" }));
    });
    expect(toast.success).toHaveBeenCalledTimes(1);
    const [message, options] = vi.mocked(toast.success).mock.calls[0] as [string, { action: { label: string; onClick: () => void } }];
    expect(message).toBe("Repeating every month from Nov 1, 2026.");
    expect(options.action.label).toBe("View schedule");
  });
});
