import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { ScheduleActions } from "./schedule-actions";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

// What can be done with a schedule depends on where it stands (spec 4): an active one can be edited,
// paused or ended; a paused one resumed (and says why it paused); an ended one is finished.

type Command = () => Promise<{ ok: true } | { ok: false; error: string }>;

function renderActions(status: "active" | "paused" | "ended", props: { pauseReason?: string | null } = {}) {
  const pause = vi.fn<Command>(async () => ({ ok: true }));
  const resume = vi.fn<Command>(async () => ({ ok: true }));
  const end = vi.fn<Command>(async () => ({ ok: true }));
  render(<ScheduleActions id="sch-1" status={status} pauseReason={props.pauseReason ?? null} pause={pause} resume={resume} end={end} />);
  return { pause, resume, end };
}

const click = (name: string | RegExp) =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });

afterEach(() => vi.clearAllMocks());

describe("a schedule's actions", () => {
  it("lets an active schedule be edited, paused or ended", () => {
    renderActions("active");
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/recurring/sch-1/edit");
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume" })).not.toBeInTheDocument();
  });

  it("pauses straight away and says so", async () => {
    const { pause } = renderActions("active");
    await click("Pause");
    expect(pause).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Schedule paused.");
  });

  it("offers Resume for a paused schedule and shows why it paused", async () => {
    const { resume } = renderActions("paused", { pauseReason: "This customer was archived." });
    expect(screen.getByText("This customer was archived.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
    await click("Resume");
    expect(resume).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Schedule resumed.");
  });

  it("offers nothing for an ended schedule", () => {
    renderActions("ended");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("asks before ending, and ends only after confirming", async () => {
    const { end } = renderActions("active");
    await click("End");
    expect(end).not.toHaveBeenCalled();
    expect(screen.getByText("No more statements will be prepared. The ones already made stay.")).toBeInTheDocument();
    await click("End schedule");
    expect(end).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Schedule ended.");
  });

  it("shows a problem as a toast and does not claim success", async () => {
    const { pause } = renderActions("active");
    pause.mockResolvedValueOnce({ ok: false, error: "This schedule was changed somewhere else. Reload to see it." });
    await click("Pause");
    expect(toast.error).toHaveBeenCalledWith("This schedule was changed somewhere else. Reload to see it.");
    expect(toast.success).not.toHaveBeenCalled();
  });
});
