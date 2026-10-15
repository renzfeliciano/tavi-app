import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MARKETS } from "@/config/markets";
import { OrderForm, type OrderFormProps } from "./order-form";

const push = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const save = vi.fn();
const issue = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) }) }));
vi.mock("../actions", () => ({
  savePurchaseOrderDraftAction: (...a: unknown[]) => save(...a),
  issuePurchaseOrderAction: (...a: unknown[]) => issue(...a),
  searchSuppliersAction: vi.fn(async () => []),
}));
// The real picker talks to the server; this one offers one supplier.
vi.mock("@/components/async-combobox", () => ({
  AsyncCombobox: ({ onValueChange, label, value }: { onValueChange: (value: unknown) => void; label: string; value: { displayName: string } | null }) => (
    <button
      type="button"
      onClick={() => onValueChange({ id: "11111111-1111-4111-8111-111111111111", displayName: "Santos Hardware", detail: null, email: "orders@santos.example" })}
    >
      {label}: {value ? value.displayName : "pick Santos"}
    </button>
  ),
}));

const market = MARKETS.PH;
const SANTOS = { id: "11111111-1111-4111-8111-111111111111", displayName: "Santos Hardware", detail: null, email: "orders@santos.example" };
const line = (over = {}) => ({
  key: "a",
  description: "Copy paper",
  quantity: "2",
  unitLabel: "box",
  unitPrice: "100",
  discountKind: "none" as const,
  discountValue: "",
  taxRateId: "",
  sourceKind: "" as const,
  sourceId: "",
  ...over,
});
const props = (over: Partial<OrderFormProps> = {}): OrderFormProps => ({
  orderId: null,
  initial: { supplier: null, currency: "PHP", orderDate: "2026-10-15", expectedDate: "", notes: "", terms: "", lines: [] },
  currencies: [{ code: "PHP", label: "PHP · Philippine Peso" }],
  taxRates: [],
  defaultTaxRateId: null,
  taxMode: "exclusive",
  units: market.units.options,
  defaultUnit: market.units.service,
  lineExample: null,
  locale: "en-PH",
  emailVerified: true,
  emailExample: market.examples.email,
  ...over,
});
const ready = () => props({ initial: { ...props().initial, supplier: SANTOS, lines: [line()] } });

beforeEach(() => {
  vi.clearAllMocks();
  save.mockResolvedValue({ ok: true, id: "po-1" });
  issue.mockResolvedValue({ ok: true, number: "PO-000001" });
});

describe("OrderForm", () => {
  it("starts with today's order date, no expected date and a total of zero", () => {
    render(<OrderForm {...props()} />);
    expect(screen.getByLabelText("Order date")).toHaveValue("2026-10-15");
    expect(screen.getByLabelText("Expected by")).toHaveValue("");
    expect(screen.getByText("Total").parentElement).toHaveTextContent("₱0.00");
  });

  it("works out the total as lines change", () => {
    render(<OrderForm {...props({ initial: { ...props().initial, lines: [line()] } })} />);
    expect(screen.getByText("Total").parentElement).toHaveTextContent("₱200.00");
    fireEvent.change(screen.getByLabelText("Qty"), { target: { value: "3" } });
    expect(screen.getByText("Total").parentElement).toHaveTextContent("₱300.00");
  });

  it("points to adding a supplier when the one needed isn't listed", () => {
    render(<OrderForm {...props()} />);
    expect(screen.getByRole("link", { name: "Add a supplier" })).toHaveAttribute("href", "/suppliers/new");
  });

  it("saves a draft as typed (even without a supplier), says so and opens the order", async () => {
    render(<OrderForm {...props()} />);
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Deliver to the back door." } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Draft saved."));
    expect(save).toHaveBeenCalledWith(null, expect.objectContaining({ supplierId: "", currency: "PHP", orderDate: "2026-10-15", notes: "Deliver to the back door." }));
    expect(push).toHaveBeenCalledWith("/purchase-orders/po-1");
  });

  it("updates the same draft when editing one", async () => {
    render(<OrderForm {...props({ orderId: "po-9" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith("po-9", expect.anything()));
  });

  it("shows what the server refused next to the field", async () => {
    save.mockResolvedValue({ ok: false, errors: { expectedDate: "Choose a date on or after the order date." } });
    render(<OrderForm {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    const message = await screen.findByText("Choose a date on or after the order date.");
    expect(screen.getByLabelText("Expected by")).toHaveAttribute("aria-describedby", message.id);
    expect(push).not.toHaveBeenCalled();
  });

  it("says when saving failed for another reason", async () => {
    save.mockResolvedValue({ ok: false, error: "Couldn't save. Please try again." });
    render(<OrderForm {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Couldn't save. Please try again."));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save. Please try again.");
  });

  it("says what is missing instead of issuing a draft with no supplier or items", () => {
    render(<OrderForm {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "Issue" }));
    expect(screen.getByText("Choose a supplier before issuing.")).toBeInTheDocument();
    expect(screen.getByText("Add at least one item before issuing.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it("asks before issuing, then saves, issues and opens the numbered order", async () => {
    render(<OrderForm {...ready()} />);
    fireEvent.click(screen.getByRole("button", { name: "Issue" }));
    const dialog = screen.getByRole("dialog", { name: "Issue this purchase order?" });
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Issue purchase order" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("PO-000001 issued."));
    expect(save).toHaveBeenCalledWith(null, expect.objectContaining({ supplierId: SANTOS.id }));
    expect(issue).toHaveBeenCalledWith("po-1", { to: "orders@santos.example", message: "" });
    expect(push).toHaveBeenCalledWith("/purchase-orders/po-1");
  });

  it("emails nobody when the box is cleared", async () => {
    render(<OrderForm {...ready()} />);
    fireEvent.click(screen.getByRole("button", { name: "Issue" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Email it to the supplier now/ }));
    fireEvent.click(screen.getByRole("button", { name: "Issue purchase order" }));
    await waitFor(() => expect(issue).toHaveBeenCalledWith("po-1", null));
  });

  it("doesn't offer to email when the person's own address isn't confirmed", () => {
    render(<OrderForm {...{ ...ready(), emailVerified: false }} />);
    fireEvent.click(screen.getByRole("button", { name: "Issue" }));
    expect(screen.queryByRole("checkbox", { name: /Email it to the supplier now/ })).not.toBeInTheDocument();
  });

  it("keeps the draft it saved when issuing fails, so a retry doesn't make a second one", async () => {
    issue.mockResolvedValueOnce({ ok: false, error: "Confirm your email address before issuing." });
    render(<OrderForm {...ready()} />);
    fireEvent.click(screen.getByRole("button", { name: "Issue" }));
    fireEvent.click(screen.getByRole("button", { name: "Issue purchase order" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Confirm your email address before issuing."));
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Issue" }));
    fireEvent.click(screen.getByRole("button", { name: "Issue purchase order" }));
    await waitFor(() => expect(issue).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith("po-1", expect.anything());
  });

  it("shows a bad email address in the dialog, beside the field", async () => {
    issue.mockResolvedValueOnce({ ok: false, errors: { emailTo: "Enter a valid email address." } });
    render(<OrderForm {...ready()} />);
    fireEvent.click(screen.getByRole("button", { name: "Issue" }));
    fireEvent.click(screen.getByRole("button", { name: "Issue purchase order" }));
    const message = await screen.findByText("Enter a valid email address.");
    expect(screen.getByLabelText("Send to")).toHaveAttribute("aria-describedby", message.id);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
