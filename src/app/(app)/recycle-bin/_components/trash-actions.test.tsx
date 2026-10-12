import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmptyBinButton, RestoreButton, TrashRowActions } from "./trash-actions";

const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
const push = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => vi.clearAllMocks());

describe("TrashRowActions", () => {
  it("restores and says where it went, with a way to open it", async () => {
    const restore = vi.fn().mockResolvedValue({ ok: true, href: "/invoices/abc", note: null });
    render(<TrashRowActions name="Billing statement draft for Juan" restore={restore} discard={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith(
      "Billing statement draft for Juan restored.",
      expect.objectContaining({ action: expect.objectContaining({ label: "Open" }) }),
    );
    (toast.success.mock.calls[0]![1] as { action: { onClick: () => void } }).action.onClick();
    expect(push).toHaveBeenCalledWith("/invoices/abc");
  });

  it("passes on a note, such as a draft that came back without its quote", async () => {
    const restore = vi.fn().mockResolvedValue({ ok: true, href: "/invoices/abc", note: "Its quotation was turned into another billing statement, so this one stands alone." });
    render(<TrashRowActions name="Draft" restore={restore} discard={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Draft restored.", expect.objectContaining({ description: expect.stringContaining("stands alone") })));
  });

  it("toasts a failure and offers no delete when the person can't delete for good", async () => {
    const restore = vi.fn().mockResolvedValue({ ok: false, error: "That item is no longer in the recycle bin." });
    render(<TrashRowActions name="Draft" restore={restore} discard={null} />);
    expect(screen.queryByRole("button", { name: /Delete forever/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("That item is no longer in the recycle bin."));
  });

  it("asks before deleting for good, then does it", async () => {
    const discard = vi.fn().mockResolvedValue({ ok: true });
    render(<TrashRowActions name="Quotation draft for Maria" restore={vi.fn()} discard={discard} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete forever" }));
    expect(discard).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/can't be brought back/)).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Delete forever" }).at(-1)!);
    await waitFor(() => expect(discard).toHaveBeenCalled());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Quotation draft for Maria deleted for good."));
  });
});

describe("EmptyBinButton", () => {
  it("asks first and says how many went", async () => {
    const empty = vi.fn().mockResolvedValue({ ok: true, removed: 3 });
    render(<EmptyBinButton count={3} empty={empty} />);

    fireEvent.click(screen.getByRole("button", { name: "Empty recycle bin" }));
    expect(screen.getByText(/3 deleted drafts/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Empty recycle bin" }).at(-1)!);
    await waitFor(() => expect(empty).toHaveBeenCalled());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Recycle bin emptied."));
  });
});

describe("RestoreButton", () => {
  it("restores an archived record in one tap", async () => {
    const restore = vi.fn().mockResolvedValue({ ok: true });
    render(<RestoreButton name="Juan Dela Cruz" restore={restore} />);
    fireEvent.click(screen.getByRole("button", { name: "Restore Juan Dela Cruz" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Juan Dela Cruz restored."));
  });

  it("says when it didn't work", async () => {
    render(<RestoreButton name="VAT" restore={vi.fn().mockResolvedValue({ ok: false, error: "Not found." })} />);
    fireEvent.click(screen.getByRole("button", { name: "Restore VAT" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Not found."));
  });
});
