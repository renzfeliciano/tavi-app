import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VoidCertificateDialog } from "./void-certificate-dialog";

const refresh = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const voidCertificateAction = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));
vi.mock("sonner", () => ({ toast: { success: (...args: unknown[]) => toastSuccess(...args), error: (...args: unknown[]) => toastError(...args) } }));
vi.mock("../actions", () => ({ voidCertificateAction: (...args: unknown[]) => voidCertificateAction(...args) }));

const setup = (paymentCount = 2) => render(<VoidCertificateDialog certificateId="c1" short="2307" payorName="Dela Cruz Trading" paymentCount={paymentCount} />);
const open = () => fireEvent.click(screen.getByRole("button", { name: "Void" }));

beforeEach(() => {
  refresh.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  voidCertificateAction.mockReset();
});

describe("VoidCertificateDialog", () => {
  it("asks first, and says what happens to the payments", () => {
    setup();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    open();

    expect(screen.getByRole("dialog", { name: "Void this 2307?" })).toBeInTheDocument();
    expect(screen.getByText(/The 2 payments on it go back to "2307 pending"/)).toBeInTheDocument();
    expect(voidCertificateAction).not.toHaveBeenCalled();
  });

  it("says nothing about payments when none were on it", () => {
    setup(0);
    open();

    expect(screen.queryByText(/go back to/)).not.toBeInTheDocument();
  });

  it("shows the server's problem with the reason beside the field", async () => {
    voidCertificateAction.mockResolvedValue({ ok: false, errors: { reason: "Give a reason. It's kept with the record." } });
    setup();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Void 2307" }));

    const error = await screen.findByText("Give a reason. It's kept with the record.");
    const reason = screen.getByLabelText("Reason");
    expect(reason).toHaveAttribute("aria-invalid", "true");
    expect(reason).toHaveAttribute("aria-describedby", error.id);
    expect(voidCertificateAction).toHaveBeenCalledWith("c1", "");
  });

  it("voids with the reason, tells the person, and closes", async () => {
    voidCertificateAction.mockResolvedValue({ ok: true });
    setup();
    open();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Wrong payor" } });
    fireEvent.click(screen.getByRole("button", { name: "Void 2307" }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("2307 voided.", expect.anything()));
    expect(voidCertificateAction).toHaveBeenCalledWith("c1", "Wrong payor");
    expect(refresh).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps the dialog open and says so when the void fails", async () => {
    voidCertificateAction.mockResolvedValue({ ok: false, error: "This 2307 is already void." });
    setup();
    open();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Wrong payor" } });
    fireEvent.click(screen.getByRole("button", { name: "Void 2307" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("This 2307 is already void."));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("gives the reason field an example", () => {
    setup();
    open();

    expect(screen.getByLabelText("Reason")).toHaveAttribute("placeholder", "e.g. Recorded under the wrong customer.");
  });
});
