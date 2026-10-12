import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentQrEditor } from "./payment-qr-editor";

const save = vi.fn();
const decode = vi.fn();
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("./actions", () => ({ savePaymentQrs: (...args: unknown[]) => save(...args) }));
vi.mock("@/shared/qr/qr-decode", () => ({ decodeQrFile: (...args: unknown[]) => decode(...args) }));
vi.mock("sonner", () => ({ toast }));

const gcash = { label: "GCash", value: "https://pay.example/gcash", enabled: true };
const view = (initial = [gcash], editable = true) =>
  render(<PaymentQrEditor initial={initial} editable={editable} where="quotations and billing statements" />);

beforeEach(() => {
  vi.clearAllMocks();
  save.mockResolvedValue({ ok: true });
});

describe("PaymentQrEditor", () => {
  it("shows a saved code with its preview, and nothing to save until something changes", () => {
    view();
    expect(screen.getByDisplayValue("GCash")).toBeTruthy();
    expect(screen.getByRole("img", { name: "GCash QR code" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save QR codes" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("adds up to three codes", () => {
    view([]);
    expect(screen.getByText("No QR codes yet.")).toBeTruthy();
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: /Add a QR code/ }));
    expect(screen.getAllByLabelText("Name")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /Add a QR code/ })).toBeNull();
  });

  it("saves what was typed and says so", async () => {
    view([]);
    fireEvent.click(screen.getByRole("button", { name: /Add a QR code/ }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Maya" } });
    fireEvent.change(screen.getByLabelText("Payment link or QR code text"), { target: { value: "https://pay.example/maya" } });
    fireEvent.click(screen.getByRole("button", { name: "Save QR codes" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Payment QR codes saved.", expect.anything()));
    expect(save).toHaveBeenCalledWith([{ label: "Maya", value: "https://pay.example/maya", enabled: true }]);
  });

  it("shows the server's field errors next to the field and toasts the failure", async () => {
    save.mockResolvedValue({ ok: false, errors: { "0.value": "Use a link that starts with https://." } });
    view();
    fireEvent.change(screen.getByLabelText("Payment link or QR code text"), { target: { value: "http://x" } });
    fireEvent.click(screen.getByRole("button", { name: "Save QR codes" }));
    expect(await screen.findByText("Use a link that starts with https://.")).toBeTruthy();
    expect(toast.error).toHaveBeenCalled();
  });

  it("removes a code and saves the empty list", async () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: /Remove/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save QR codes" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Payment QR codes removed.", expect.anything()));
    expect(save).toHaveBeenCalledWith([]);
  });

  it("reads a screenshot into the field, or says it couldn't", async () => {
    view([{ ...gcash, value: "" }]);
    const file = new File(["x"], "qr.png", { type: "image/png" });
    const input = screen.getByLabelText("QR code screenshot");

    decode.mockResolvedValueOnce(null);
    fireEvent.click(screen.getByRole("button", { name: /Upload screenshot/ }));
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("couldn't find a QR code")));

    decode.mockResolvedValueOnce("https://pay.example/read");
    fireEvent.click(screen.getByRole("button", { name: /Upload screenshot/ }));
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect((screen.getByLabelText("Payment link or QR code text") as HTMLTextAreaElement).value).toBe("https://pay.example/read"));
  });

  it("is read-only without permission", () => {
    view([gcash], false);
    expect(screen.queryByRole("button", { name: "Save QR codes" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Add a QR code/ })).toBeNull();
    expect((screen.getByLabelText("Name") as HTMLInputElement).disabled).toBe(true);
  });
});
