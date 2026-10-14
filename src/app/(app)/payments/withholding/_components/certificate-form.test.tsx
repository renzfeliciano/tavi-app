import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MARKETS } from "@/config/markets";
import type { PendingPayment } from "@/modules/payments";
import type { RawCertificate } from "@/modules/payments/client";
import { CertificateForm, type CertificateFormProps } from "./certificate-form";

const push = vi.fn();
const toastSuccess = vi.fn();
const recordCertificateAction = vi.fn();
const updateCertificateAction = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: (...args: unknown[]) => toastSuccess(...args), error: vi.fn() }) }));
vi.mock("../actions", () => ({
  recordCertificateAction: (...args: unknown[]) => recordCertificateAction(...args),
  updateCertificateAction: (...args: unknown[]) => updateCertificateAction(...args),
}));

const market = MARKETS.PH;

const payment = (id: string, paidOn: string, withheldMinor: number): PendingPayment => ({
  paymentId: id,
  receiptNumber: `OR-${id}`,
  paidOn,
  invoiceId: "i1",
  invoiceNumber: "INV-000001",
  withheldMinor,
  currency: "PHP",
});

const blankLine = { atcCode: "", description: "", rate: "", month1: "", month2: "", month3: "", taxWithheld: "" };
const initial: RawCertificate = {
  customerId: "11111111-1111-4111-8111-111111111111",
  payorTin: "123-456-789-00000",
  payorName: "Dela Cruz Trading",
  payorAddress: "",
  year: "2026",
  quarter: "3",
  receivedOn: "2026-10-13",
  notes: "",
  lines: [blankLine],
  paymentIds: ["p1", "p2"],
};

function setup(over: Partial<CertificateFormProps> = {}) {
  return render(
    <CertificateForm
      customerName="Juan Dela Cruz"
      initial={initial}
      pendingPayments={[payment("p1", "2026-07-01", 1_000), payment("p2", "2026-09-30", 2_000), payment("p3", "2026-10-02", 500)]}
      atcs={market.withholdingAtcs}
      currency="PHP"
      locale="en-PH"
      today="2026-10-13"
      certificate={market.taxWithheld!.certificate}
      tinLabel={market.taxId.label}
      tinExample={market.taxId.example}
      examples={market.examples}
      scan={null}
      {...over}
    />,
  );
}

beforeEach(() => {
  push.mockReset();
  toastSuccess.mockReset();
  recordCertificateAction.mockReset();
  updateCertificateAction.mockReset();
});

const atcSelects = () => screen.getAllByLabelText(/^ATC$/);

describe("rows", () => {
  it("starts with one row, adds up to five and removes back to one", () => {
    setup();
    expect(atcSelects()).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^Remove row/ })).not.toBeInTheDocument();

    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole("button", { name: "Add a row" }));
    expect(atcSelects()).toHaveLength(5);
    expect(screen.queryByRole("button", { name: "Add a row" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove row 5" }));
    expect(atcSelects()).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Add a row" })).toBeInTheDocument();
  });

  it("fills the rate when an ATC is picked, and asks for the code and rate when it is Other", () => {
    setup();
    expect(screen.queryByLabelText("ATC code")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^ATC$/), { target: { value: "WI160" } });
    expect(screen.getByLabelText("Rate (%)")).toHaveValue("2");

    fireEvent.change(screen.getByLabelText(/^ATC$/), { target: { value: "other" } });
    expect(screen.getByLabelText("ATC code")).toBeInTheDocument();
    expect(screen.getByLabelText("ATC code")).toHaveAttribute("placeholder", `e.g. ${market.withholdingAtcs[0]?.code}`);
  });

  it("names the quarter's real months and adds them into the total", () => {
    setup();
    fireEvent.change(screen.getByLabelText(/^ATC$/), { target: { value: "WI160" } });

    fireEvent.change(screen.getByLabelText("July"), { target: { value: "1,000" } });
    fireEvent.change(screen.getByLabelText("September"), { target: { value: "500.50" } });

    expect(screen.getByLabelText("August")).toBeInTheDocument();
    expect(screen.getByText("Total income payments ₱1,500.50")).toBeInTheDocument();
  });

  it("calculates the tax withheld from the rate until the person types what the form says", () => {
    setup();
    fireEvent.change(screen.getByLabelText(/^ATC$/), { target: { value: "WI160" } });
    fireEvent.change(screen.getByLabelText("July"), { target: { value: "1,000" } });
    expect(screen.getByLabelText(/^Tax withheld/)).toHaveValue("20.00");

    fireEvent.change(screen.getByLabelText(/^Tax withheld/), { target: { value: "19.99" } });
    fireEvent.change(screen.getByLabelText("August"), { target: { value: "1,000" } });
    expect(screen.getByLabelText(/^Tax withheld/)).toHaveValue("19.99");
  });
});

describe("the payments it covers", () => {
  it("ticks the customer's payments dated in the quarter and leaves out the others", () => {
    setup();
    const list = screen.getByRole("group", { name: /Payments this covers/ });

    expect(within(list).getByRole("checkbox", { name: /OR-p1/ })).toBeChecked();
    expect(within(list).getByRole("checkbox", { name: /OR-p2/ })).toBeChecked();
    expect(within(list).queryByRole("checkbox", { name: /OR-p3/ })).not.toBeInTheDocument();
  });

  it("changes the list with the quarter, ticking what falls inside it", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Quarter"), { target: { value: "4" } });
    const list = screen.getByRole("group", { name: /Payments this covers/ });

    expect(within(list).getByRole("checkbox", { name: /OR-p3/ })).toBeChecked();
    expect(within(list).queryByRole("checkbox", { name: /OR-p1/ })).not.toBeInTheDocument();
  });

  it("says when none of them fall in the quarter", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Quarter"), { target: { value: "1" } });

    expect(screen.getByText(/No payments with tax withheld are waiting in this quarter/)).toBeInTheDocument();
  });

  it("compares the form's tax with the ticked payments as you go", () => {
    setup();
    // 10.00 + 20.00 withheld on the ticked payments; nothing typed on the form yet.
    expect(screen.getByRole("status", { name: "Comparison with payments" })).toHaveTextContent("Differs by ₱30.00");

    fireEvent.change(screen.getByLabelText(/^ATC$/), { target: { value: "WI160" } });
    fireEvent.change(screen.getByLabelText("August"), { target: { value: "1,500" } });
    expect(screen.getByRole("status", { name: "Comparison with payments" })).toHaveTextContent("Matches");

    fireEvent.click(screen.getByRole("checkbox", { name: /OR-p2/ }));
    expect(screen.getByRole("status", { name: "Comparison with payments" })).toHaveTextContent("Differs by ₱20.00");
  });
});

describe("saving", () => {
  const fillOneRow = () => {
    fireEvent.change(screen.getByLabelText(/^ATC$/), { target: { value: "WI160" } });
    fireEvent.change(screen.getByLabelText("August"), { target: { value: "1,500" } });
  };

  it("sends the certificate as typed, then opens it", async () => {
    recordCertificateAction.mockResolvedValue({ ok: true, id: "c9" });
    setup();
    fillOneRow();
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/payments/withholding/c9"));
    const form = recordCertificateAction.mock.calls[0]?.[0] as FormData;
    const sent = JSON.parse(String(form.get("data"))) as RawCertificate;
    expect(sent).toMatchObject({
      customerId: initial.customerId,
      payorTin: "123-456-789-00000",
      payorName: "Dela Cruz Trading",
      year: "2026",
      quarter: "3",
      paymentIds: ["p1", "p2"],
      lines: [{ atcCode: "WI160", rate: "2", month1: "", month2: "1,500", month3: "", taxWithheld: "30.00" }],
    });
    expect(toastSuccess).toHaveBeenCalledWith("2307 recorded.");
  });

  it("shows progress and stops a second press while it saves", async () => {
    let finish: (value: unknown) => void = () => {};
    recordCertificateAction.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    setup();
    fillOneRow();
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));

    const button = await screen.findByRole("button", { name: /Saving/ });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(recordCertificateAction).toHaveBeenCalledTimes(1);

    await act(async () => finish({ ok: true, id: "c9" }));
  });

  it("puts each problem next to its field and moves focus to the first", async () => {
    recordCertificateAction.mockResolvedValue({
      ok: false,
      errors: {
        payorTin: "Enter the payor's TIN as written on the form: at least 9 digits.",
        "lines.0.month2": "Enter an amount like ₱1,200.50.",
        paymentIds: "That payment was voided.",
      },
    });
    setup();
    fillOneRow();
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));

    const tin = await screen.findByLabelText(/^Payor's TIN/);
    await waitFor(() => expect(tin).toHaveFocus());
    expect(tin).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter the payor's TIN as written on the form: at least 9 digits.")).toHaveAttribute("id", tin.getAttribute("aria-describedby"));
    expect(screen.getByLabelText("August")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter an amount like ₱1,200.50.")).toBeInTheDocument();
    expect(screen.getByText("That payment was voided.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a problem that isn't about one field above the form", async () => {
    recordCertificateAction.mockResolvedValue({ ok: false, error: "Couldn't save. Please try again." });
    setup();
    fillOneRow();
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save. Please try again.");
  });
});

describe("editing", () => {
  it("saves changes to the certificate and names the scan it keeps", async () => {
    updateCertificateAction.mockResolvedValue({ ok: true, id: "c7" });
    setup({
      certificateId: "c7",
      initial: { ...initial, lines: [{ ...blankLine, atcCode: "WI160", rate: "2", month2: "1,500", taxWithheld: "30.00" }] },
      scan: { fileName: "2307-q3.pdf", href: "/api/files/f1" },
    });

    expect(screen.getByText("2307-q3.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove scan" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/payments/withholding/c7"));
    expect(updateCertificateAction.mock.calls[0]?.[0]).toBe("c7");
    const form = updateCertificateAction.mock.calls[0]?.[1] as FormData;
    expect(form.get("removeScan")).toBe("1");
    expect(toastSuccess).toHaveBeenCalledWith("2307 saved.");
  });
});

describe("labels", () => {
  it("gives every field a name and an example while it is empty", () => {
    setup();

    expect(screen.getByLabelText(/^Payor's TIN/)).toHaveAttribute("placeholder", `e.g. ${market.taxId.example}`);
    expect(screen.getByLabelText(/^Payor's name/)).toHaveAttribute("placeholder", expect.stringMatching(/^e\.g\. /));
    expect(screen.getByLabelText(/^Payor's address/)).toHaveAttribute("placeholder", expect.stringMatching(/^e\.g\. /));
    expect(screen.getByLabelText(/^Notes/)).toHaveAttribute("placeholder", expect.stringMatching(/^e\.g\. /));
    expect(screen.getByLabelText("July")).toHaveAttribute("placeholder", "0.00");
    expect(screen.getByLabelText("Date received")).toHaveValue("2026-10-13");
  });
});
