import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MARKETS } from "@/config/markets";
import { InvoicePayments } from "./invoice-payments";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("../../payments/actions", () => ({ recordPaymentAction: vi.fn(), voidPaymentAction: vi.fn() }));

const market = MARKETS.PH;

function open() {
  render(
    <InvoicePayments
      invoiceId="a"
      name="Billing statement INV-000001"
      currency="PHP"
      locale="en-PH"
      today="2026-10-13"
      balanceMinor={150_000}
      payable
      canRecord
      canVoid
      customerEmail={null}
      methodLabels={market.paymentMethodLabels}
      detailLabels={market.paymentDetailLabels}
      detailExamples={market.paymentDetailExamples}
      chequeDateLabel={market.chequeDateLabel}
      taxWithheld={market.taxWithheld}
      receiptTitle="Payment acknowledgement"
      payments={[]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /^Record payment/ }));
}

describe("the Record payment dialog examples", () => {
  it("shows what a bank transfer's reference, bank and sender look like", () => {
    open();

    expect(screen.getByLabelText(/^Reference no\./)).toHaveAttribute("placeholder", `e.g. ${market.paymentDetailExamples.bank_transfer.reference}`);
    expect(screen.getByLabelText(/^Bank/)).toHaveAttribute("placeholder", "e.g. BDO");
    expect(screen.getByLabelText(/^Sender/)).toHaveAttribute("placeholder", "e.g. Juan Dela Cruz");
  });

  it("changes the examples with the method, as the labels do", () => {
    open();

    fireEvent.change(screen.getByLabelText("Method"), { target: { value: "ewallet" } });

    expect(screen.getByLabelText(/^Wallet/)).toHaveAttribute("placeholder", "e.g. GCash");
    expect(screen.getByLabelText(/^Sender/)).toHaveAttribute("placeholder", "e.g. 0917 123 4567");
  });

  it("gives the amount, the withheld tax and the notes an example too", () => {
    open();

    expect(screen.getByLabelText(/^Tax withheld/)).toHaveAttribute("placeholder", "0.00");
    expect(screen.getByLabelText(/^Notes/)).toHaveAttribute("placeholder", expect.stringMatching(/^e\.g\. /));
  });
});
