import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MARKETS } from "@/config/markets";
import { eg } from "@/shared/text/example";
import { ReceiptForm, type ReceiptFormProps } from "./receipt-form";

const push = vi.fn();
const toastSuccess = vi.fn();
const issueReceiptAction = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: (...args: unknown[]) => toastSuccess(...args), error: vi.fn() }) }));
vi.mock("../actions", () => ({
  issueReceiptAction: (...args: unknown[]) => issueReceiptAction(...args),
  searchReceiptCustomersAction: vi.fn(async () => []),
}));
// The real picker talks to the server; this one offers one customer.
vi.mock("@/components/async-combobox", () => ({
  AsyncCombobox: ({ onValueChange, label }: { onValueChange: (value: unknown) => void; label: string }) => (
    <button type="button" onClick={() => onValueChange({ id: "11111111-1111-4111-8111-111111111111", displayName: "Juan Dela Cruz", detail: null, email: "juan@example.com" })}>
      {label}: pick Juan
    </button>
  ),
}));

const market = MARKETS.PH;
const props: ReceiptFormProps = {
  kinds: [
    { value: "collection", title: market.documents.receiptKinds.collection.title },
    { value: "acknowledgement", title: market.documents.receiptKinds.acknowledgement.title },
  ],
  currency: "PHP",
  locale: "en-PH",
  today: "2026-10-15",
  methodLabels: market.paymentMethodLabels,
  detailLabels: market.paymentDetailLabels,
  detailExamples: market.paymentDetailExamples,
  chequeDateLabel: market.chequeDateLabel,
  purposeExample: market.examples.receiptPurpose,
  payerExample: market.examples.person,
};

function fill(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
  issueReceiptAction.mockResolvedValue({ ok: true, id: "r-1", receiptNumber: "REC-000124" });
});

describe("ReceiptForm", () => {
  it("offers both titles from the market, with the collection receipt chosen", () => {
    render(<ReceiptForm {...props} />);
    const title = screen.getByLabelText("Title") as HTMLSelectElement;
    expect(title.value).toBe("collection");
    expect([...title.options].map((o) => o.text)).toEqual(["Collection receipt", "Acknowledgement receipt"]);
  });

  it("fills the payer's name from the customer picked", () => {
    render(<ReceiptForm {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /pick Juan/ }));
    expect((screen.getByLabelText("Payer's name") as HTMLInputElement).value).toBe("Juan Dela Cruz");
  });

  it("lets the person type a payer who isn't a customer", () => {
    render(<ReceiptForm {...props} />);
    fireEvent.click(screen.getByRole("radio", { name: "Someone else" }));
    expect(screen.queryByRole("button", { name: /pick Juan/ })).toBeNull();
    expect((screen.getByLabelText("Payer's name") as HTMLInputElement).value).toBe("");
  });

  it("asks for the cheque's own date only for a cheque", () => {
    render(<ReceiptForm {...props} />);
    expect(screen.queryByLabelText(new RegExp(market.chequeDateLabel))).toBeNull();
    fill("Method", "cheque");
    expect(screen.getByLabelText(new RegExp(market.chequeDateLabel))).toBeTruthy();
  });

  it("shows the market's example name in the payer's field", () => {
    render(<ReceiptForm {...props} />);
    expect((screen.getByLabelText("Payer's name") as HTMLInputElement).placeholder).toBe(eg(market.examples.person));
  });

  it("shows the market's example in the received-for field", () => {
    render(<ReceiptForm {...props} />);
    expect((screen.getByLabelText("Received for") as HTMLInputElement).placeholder).toBe(eg(market.examples.receiptPurpose));
  });

  it("makes the receipt, says so and opens it", async () => {
    render(<ReceiptForm {...props} />);
    fireEvent.click(screen.getByRole("radio", { name: "Someone else" }));
    fill("Payer's name", "Maria Santos");
    fill(/Amount received/, "1,500");
    fill("Received for", "Reimbursement of fuel");
    fireEvent.click(screen.getByRole("button", { name: "Make receipt" }));
    await waitFor(() => expect(issueReceiptAction).toHaveBeenCalledTimes(1));
    expect(issueReceiptAction.mock.calls[0]?.[0]).toMatchObject({
      raw: { kind: "collection", customerId: "", payer: "Maria Santos", amount: "1,500", receivedOn: "2026-10-15", method: "cash", purpose: "Reimbursement of fuel" },
      recipients: [],
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/receipts/r-1"));
    expect(toastSuccess).toHaveBeenCalledWith("Receipt REC-000124 made.");
  });

  it("offers the customer's email and sends the copy by default", async () => {
    render(<ReceiptForm {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /pick Juan/ }));
    expect(screen.getByRole("checkbox", { name: /Email a copy to juan@example.com/ }).getAttribute("aria-checked")).toBe("true");
    fill(/Amount received/, "500");
    fill("Received for", "Deposit");
    fireEvent.click(screen.getByRole("button", { name: "Make receipt" }));
    await waitFor(() => expect(issueReceiptAction).toHaveBeenCalled());
    expect(issueReceiptAction.mock.calls[0]?.[0]).toMatchObject({ raw: { customerId: "11111111-1111-4111-8111-111111111111" }, recipients: ["juan@example.com"] });
  });

  it("shows a field's problem next to the field and stays on the page", async () => {
    issueReceiptAction.mockResolvedValue({ ok: false, errors: { amount: "Enter the amount received." } });
    render(<ReceiptForm {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Make receipt" }));
    const message = await screen.findByText("Enter the amount received.");
    expect(screen.getByLabelText(/Amount received/).getAttribute("aria-describedby")).toBe(message.id);
    expect(push).not.toHaveBeenCalled();
  });

  it("sends the same key on a retry and a new one once the details change", async () => {
    issueReceiptAction.mockResolvedValue({ ok: false, error: "Couldn't save. Please try again." });
    render(<ReceiptForm {...props} />);
    const submit = () => fireEvent.click(screen.getByRole("button", { name: "Make receipt" }));
    submit();
    await waitFor(() => expect(issueReceiptAction).toHaveBeenCalledTimes(1));
    await screen.findAllByText("Couldn't save. Please try again.");
    submit();
    await waitFor(() => expect(issueReceiptAction).toHaveBeenCalledTimes(2));
    const [first, second] = issueReceiptAction.mock.calls.map((call) => call[0].idempotencyKey);
    expect(first).toBeTruthy();
    expect(second).toBe(first);
    fill(/Amount received/, "99");
    await screen.findAllByText("Couldn't save. Please try again.");
    submit();
    await waitFor(() => expect(issueReceiptAction).toHaveBeenCalledTimes(3));
    expect(issueReceiptAction.mock.calls[2]?.[0].idempotencyKey).not.toBe(first);
  });
});
