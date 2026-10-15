import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CancelOrderDialog } from "./cancel-order-dialog";
import { DeleteDraftDialog } from "./delete-draft-dialog";
import { EmailOrderDialog } from "./email-order-dialog";
import { ReceiveOrderDialog } from "./receive-order-dialog";

const refresh = vi.fn();
const push = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const actions = {
  cancelPurchaseOrderAction: vi.fn(),
  receivePurchaseOrderAction: vi.fn(),
  emailPurchaseOrderAction: vi.fn(),
  deletePurchaseOrderDraftAction: vi.fn(),
};
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: (...a: unknown[]) => push(...a), refresh }) }));
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) } }));
vi.mock("../actions", () => ({
  cancelPurchaseOrderAction: (...a: unknown[]) => actions.cancelPurchaseOrderAction(...a),
  receivePurchaseOrderAction: (...a: unknown[]) => actions.receivePurchaseOrderAction(...a),
  emailPurchaseOrderAction: (...a: unknown[]) => actions.emailPurchaseOrderAction(...a),
  deletePurchaseOrderDraftAction: (...a: unknown[]) => actions.deletePurchaseOrderDraftAction(...a),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CancelOrderDialog", () => {
  const setup = () => render(<CancelOrderDialog orderId="o1" number="PO-000007" />);
  const open = () => fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));

  it("asks first and changes nothing until confirmed", () => {
    setup();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    open();
    expect(screen.getByRole("dialog", { name: "Cancel PO-000007?" })).toBeInTheDocument();
    expect(actions.cancelPurchaseOrderAction).not.toHaveBeenCalled();
  });

  it("shows a missing reason next to the field", async () => {
    actions.cancelPurchaseOrderAction.mockResolvedValue({ ok: false, error: "Say why you are cancelling it." });
    setup();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Cancel purchase order" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Say why you are cancelling it."));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("cancels once with the reason, says so and refreshes", async () => {
    actions.cancelPurchaseOrderAction.mockResolvedValue({ ok: true });
    setup();
    open();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Supplier is out of stock." } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel purchase order" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("PO-000007 cancelled.", expect.anything()));
    expect(actions.cancelPurchaseOrderAction).toHaveBeenCalledTimes(1);
    expect(actions.cancelPurchaseOrderAction).toHaveBeenCalledWith("o1", "Supplier is out of stock.");
    expect(refresh).toHaveBeenCalled();
  });
});

describe("ReceiveOrderDialog", () => {
  const setup = () => render(<ReceiveOrderDialog orderId="o1" number="PO-000007" today="2026-10-10" orderDate="2026-10-01" />);
  const open = () => fireEvent.click(screen.getByRole("button", { name: "Mark received" }));

  it("starts on today and limits the date to between the order date and today", () => {
    setup();
    open();
    const date = screen.getByLabelText("Date received");
    expect(date).toHaveValue("2026-10-10");
    expect(date).toHaveAttribute("min", "2026-10-01");
    expect(date).toHaveAttribute("max", "2026-10-10");
  });

  it("sends the date and note, says so and refreshes", async () => {
    actions.receivePurchaseOrderAction.mockResolvedValue({ ok: true });
    setup();
    open();
    fireEvent.change(screen.getByLabelText("Date received"), { target: { value: "2026-10-08" } });
    fireEvent.change(screen.getByLabelText(/Note/), { target: { value: "Two boxes short." } });
    fireEvent.click(screen.getByRole("button", { name: "Mark as received" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("PO-000007 marked received."));
    expect(actions.receivePurchaseOrderAction).toHaveBeenCalledWith("o1", { receivedDate: "2026-10-08", note: "Two boxes short." });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows a date problem next to the field", async () => {
    actions.receivePurchaseOrderAction.mockResolvedValue({ ok: false, errors: { receivedDate: "Choose today or an earlier date." } });
    setup();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Mark as received" }));
    const error = await screen.findByText("Choose today or an earlier date.");
    expect(screen.getByLabelText("Date received")).toHaveAttribute("aria-describedby", error.id);
  });
});

describe("EmailOrderDialog", () => {
  const setup = (supplierEmail: string | null = "orders@santos.example") =>
    render(<EmailOrderDialog orderId="o1" number="PO-000007" supplierEmail={supplierEmail} emailExample="maria@example.com" />);
  const open = () => fireEvent.click(screen.getByRole("button", { name: "Email supplier" }));

  it("offers the supplier's email and says the PDF is downloaded separately", () => {
    setup();
    open();
    expect(screen.getByLabelText("Send to")).toHaveValue("orders@santos.example");
    expect(screen.getByText(/PDF is for you to download/)).toBeInTheDocument();
  });

  it("starts empty when the supplier has no email", () => {
    setup(null);
    open();
    expect(screen.getByLabelText("Send to")).toHaveValue("");
  });

  it("sends once with the address and message, says who it went to and refreshes", async () => {
    actions.emailPurchaseOrderAction.mockResolvedValue({ ok: true });
    setup();
    open();
    fireEvent.change(screen.getByLabelText(/Message/), { target: { value: "Please confirm." } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Sent to orders@santos.example."));
    expect(actions.emailPurchaseOrderAction).toHaveBeenCalledWith("o1", { to: "orders@santos.example", message: "Please confirm." });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows an address problem next to the field", async () => {
    actions.emailPurchaseOrderAction.mockResolvedValue({ ok: false, errors: { emailTo: "Enter a valid email address." } });
    setup(null);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    const error = await screen.findByText("Enter a valid email address.");
    expect(screen.getByLabelText("Send to")).toHaveAttribute("aria-describedby", error.id);
  });
});

describe("DeleteDraftDialog", () => {
  const setup = () => render(<DeleteDraftDialog orderId="o1" />);

  it("asks first, then deletes and goes back to the list", async () => {
    actions.deletePurchaseOrderDraftAction.mockResolvedValue({ ok: true });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Delete draft" }));
    expect(screen.getByRole("dialog", { name: "Delete this draft?" })).toBeInTheDocument();
    expect(actions.deletePurchaseOrderDraftAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Draft deleted."));
    expect(actions.deletePurchaseOrderDraftAction).toHaveBeenCalledWith("o1");
    expect(push).toHaveBeenCalledWith("/purchase-orders");
  });

  it("tells the person when it fails", async () => {
    actions.deletePurchaseOrderDraftAction.mockResolvedValue({ ok: false, error: "Only drafts can be deleted. Cancel an issued order instead." });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Delete draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Only drafts can be deleted. Cancel an issued order instead."));
    expect(push).not.toHaveBeenCalled();
  });
});
