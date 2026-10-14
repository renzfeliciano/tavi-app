import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteRecordButton } from "./delete-record-button";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
const push = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

beforeEach(() => vi.clearAllMocks());

const props = { name: "Quotation QUO-000012", description: "The customer's link stops working.", redirectTo: "/quotes" };

describe("DeleteRecordButton", () => {
  it("asks first, and deletes nothing until it is confirmed", () => {
    const remove = vi.fn();
    render(<DeleteRecordButton {...props} remove={remove} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText("Delete Quotation QUO-000012?")).toBeTruthy();
    expect(screen.getByText(/customer's link stops working/)).toBeTruthy();
    expect(screen.getByText(/30 days/)).toBeTruthy();
    expect(remove).not.toHaveBeenCalled();
  });

  it("moves it to the recycle bin, says so, offers the bin, and leaves the page", async () => {
    const remove = vi.fn().mockResolvedValue({ ok: true });
    render(<DeleteRecordButton {...props} remove={remove} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith(
      "Quotation QUO-000012 moved to the recycle bin.",
      expect.objectContaining({ action: expect.objectContaining({ label: "View" }) }),
    );
    (toast.success.mock.calls[0]![1] as { action: { onClick: () => void } }).action.onClick();
    expect(push).toHaveBeenCalledWith("/recycle-bin");
    expect(push).toHaveBeenCalledWith("/quotes");
  });

  it("shows why it could not, and stays on the page", async () => {
    const remove = vi.fn().mockResolvedValue({ ok: false, error: "Void this payment first." });
    render(<DeleteRecordButton {...props} remove={remove} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Void this payment first."));
    expect(push).not.toHaveBeenCalled();
  });
});
