import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SentInvoiceActions } from "./sent-invoice-actions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../actions", () => ({
  cancelInvoiceAction: vi.fn(),
  createInvoiceLinkAction: vi.fn(),
  voidAndDuplicateInvoiceAction: vi.fn(),
  voidInvoiceAction: vi.fn(),
}));

// A sent bill's header used to carry seven buttons in two rows, three of them for
// things that can't be undone. The everyday ones stay as buttons; void, cancel and
// void-and-duplicate sit behind one "More actions" button.

const reminder = {
  customerName: "Juan Dela Cruz",
  businessName: "Santos Aircon",
  balanceMinor: 50000,
  currency: "PHP",
  locale: "en-PH",
  dueDate: "2026-10-28",
  today: "2026-10-13",
};

function renderActions(props: Partial<Parameters<typeof SentInvoiceActions>[0]> = {}) {
  return render(
    <SentInvoiceActions
      id="inv-1"
      status="SENT"
      name="Billing statement INV-000001"
      amountPaidMinor={0}
      registered={false}
      printed={false}
      eInvoice={false}
      canVoid
      shareChannels="Messenger or Viber"
      reminder={reminder}
      {...props}
    />,
  );
}

async function press(element: HTMLElement) {
  await act(async () => {
    fireEvent.pointerDown(element, { button: 0, pointerType: "mouse" });
    fireEvent.mouseDown(element, { button: 0 });
    fireEvent.pointerUp(element, { button: 0, pointerType: "mouse" });
    fireEvent.mouseUp(element, { button: 0 });
    fireEvent.click(element, { button: 0 });
  });
}

afterEach(() => vi.clearAllMocks());

describe("a sent billing statement's actions", () => {
  it("shows what people do every day as buttons: download, copy the link, remind, edit", () => {
    renderActions();

    expect(screen.getByRole("link", { name: "Download PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remind" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit" })).toBeInTheDocument();
  });

  it("keeps void, cancel and void-and-duplicate out of the row, behind one More actions button", () => {
    renderActions();

    expect(screen.queryByRole("button", { name: "Void and duplicate" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Void" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(screen.getByRole("button", { name: "More actions" })).toBeInTheDocument();
  });

  it("lists them in the menu, the ones that end the bill marked as dangerous", async () => {
    renderActions();

    await press(screen.getByRole("button", { name: "More actions" }));

    expect(await screen.findByRole("menuitem", { name: "Void and duplicate" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Void" })).toHaveAttribute("data-variant", "destructive");
    expect(screen.getByRole("menuitem", { name: "Cancel" })).toHaveAttribute("data-variant", "destructive");
  });

  it("still asks for a reason in a dialog before any of them, opened from the menu", async () => {
    renderActions();
    await press(screen.getByRole("button", { name: "More actions" }));

    await press(await screen.findByRole("menuitem", { name: "Void" }));

    expect(await screen.findByRole("dialog", { name: "Void Billing statement INV-000001?" })).toBeInTheDocument();
    expect(screen.getByLabelText("Reason")).toBeInTheDocument();
  });

  it("has no More actions button for someone who may not void, or once the bill is paid", () => {
    const { unmount } = renderActions({ canVoid: false });
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
    unmount();

    renderActions({ amountPaidMinor: 10000 });
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
  });
});
