import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmailReceiptDialog } from "./email-receipt-dialog";

const refresh = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const emailReceiptAction = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));
vi.mock("sonner", () => ({ toast: { success: (...args: unknown[]) => toastSuccess(...args), error: (...args: unknown[]) => toastError(...args) } }));
vi.mock("../actions", () => ({ emailReceiptAction: (...args: unknown[]) => emailReceiptAction(...args) }));

const setup = (customerEmail: string | null = "juan@example.com") =>
  render(<EmailReceiptDialog receiptId="r1" receiptNumber="REC-000007" customerEmail={customerEmail} />);
const open = () => fireEvent.click(screen.getByRole("button", { name: "Email a copy" }));
const addAddress = (value: string) => {
  fireEvent.change(screen.getByLabelText(/send to (another|an) email/i), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
};

beforeEach(() => {
  vi.clearAllMocks();
  emailReceiptAction.mockResolvedValue({ ok: true, queued: 2 });
});

describe("EmailReceiptDialog", () => {
  it("says what the email holds, and doesn't promise an attachment it doesn't send", () => {
    setup();
    open();
    expect(screen.getByText("They get the receipt's details in the email. The PDF is for you to download.")).toBeInTheDocument();
    expect(screen.queryByText(/attached/i)).toBeNull();
  });

  it("offers the customer's address, ticked", () => {
    setup();
    open();
    expect(screen.getByRole("checkbox", { name: /juan@example.com/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("sends to the customer and anyone added, and says how many", async () => {
    setup();
    open();
    addAddress("Ana@Example.com");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Sent to 2 people."));
    expect(emailReceiptAction).toHaveBeenCalledWith("r1", ["juan@example.com", "ana@example.com"]);
    expect(refresh).toHaveBeenCalled();
  });

  it("counts an address typed but not yet added", async () => {
    setup(null);
    open();
    fireEvent.change(screen.getByLabelText(/send to (another|an) email/i), { target: { value: "ana@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(emailReceiptAction).toHaveBeenCalledWith("r1", ["ana@example.com"]));
  });

  it("refuses an address that isn't one, and sends nothing", async () => {
    setup(null);
    open();
    addAddress("not-an-email");
    expect(await screen.findByText(/isn't a valid email address/)).toBeInTheDocument();
    expect(emailReceiptAction).not.toHaveBeenCalled();
  });

  it("asks for at least one address", async () => {
    setup(null);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Enter at least one email address.")).toBeInTheDocument();
    expect(emailReceiptAction).not.toHaveBeenCalled();
  });

  it("says when it can't send", async () => {
    emailReceiptAction.mockResolvedValue({ ok: false, error: "This receipt is void, so it can't be emailed." });
    setup();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("This receipt is void, so it can't be emailed."));
  });
});
