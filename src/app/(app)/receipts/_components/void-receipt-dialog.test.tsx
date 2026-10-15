import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VoidReceiptDialog } from "./void-receipt-dialog";

const refresh = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const voidReceiptAction = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));
vi.mock("sonner", () => ({ toast: { success: (...args: unknown[]) => toastSuccess(...args), error: (...args: unknown[]) => toastError(...args) } }));
vi.mock("../actions", () => ({ voidReceiptAction: (...args: unknown[]) => voidReceiptAction(...args) }));

const setup = () => render(<VoidReceiptDialog receiptId="r1" receiptNumber="REC-000007" />);
const open = () => fireEvent.click(screen.getByRole("button", { name: "Void" }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VoidReceiptDialog", () => {
  it("asks first and changes nothing until confirmed", () => {
    setup();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    open();
    expect(screen.getByRole("dialog", { name: "Void receipt REC-000007?" })).toBeInTheDocument();
    expect(screen.getByText(/stays on the record, marked void/)).toBeInTheDocument();
    expect(voidReceiptAction).not.toHaveBeenCalled();
  });

  it("shows a missing reason next to the field", async () => {
    voidReceiptAction.mockResolvedValue({ ok: false, errors: { reason: "Give a reason. It's kept with the record." } });
    setup();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Void receipt" }));
    const error = await screen.findByText("Give a reason. It's kept with the record.");
    expect(screen.getByLabelText("Reason")).toHaveAttribute("aria-describedby", error.id);
  });

  it("voids once with the reason, says so and refreshes", async () => {
    voidReceiptAction.mockResolvedValue({ ok: true });
    setup();
    open();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Wrong amount" } });
    fireEvent.click(screen.getByRole("button", { name: "Void receipt" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Receipt REC-000007 voided.", expect.anything()));
    expect(voidReceiptAction).toHaveBeenCalledTimes(1);
    expect(voidReceiptAction).toHaveBeenCalledWith("r1", "Wrong amount");
    expect(refresh).toHaveBeenCalled();
  });

  it("tells the person when it fails", async () => {
    voidReceiptAction.mockResolvedValue({ ok: false, error: "This receipt is already void." });
    setup();
    open();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Wrong amount" } });
    fireEvent.click(screen.getByRole("button", { name: "Void receipt" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("This receipt is already void."));
    expect(refresh).not.toHaveBeenCalled();
  });
});
