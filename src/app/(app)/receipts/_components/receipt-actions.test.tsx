import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReceiptActions } from "./receipt-actions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../actions", () => ({ voidReceiptAction: vi.fn(), emailReceiptAction: vi.fn() }));

const props = { receiptId: "r1", receiptNumber: "REC-000007", customerEmail: null };

describe("ReceiptActions", () => {
  it("offers Email and Void to someone who can do both", () => {
    render(<ReceiptActions {...props} canEmail canVoid voided={false} />);
    expect(screen.getByRole("button", { name: "Email a copy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Void" })).toBeInTheDocument();
  });

  it("offers only what the person may do", () => {
    const { rerender } = render(<ReceiptActions {...props} canEmail canVoid={false} voided={false} />);
    expect(screen.getByRole("button", { name: "Email a copy" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Void" })).not.toBeInTheDocument();

    rerender(<ReceiptActions {...props} canEmail={false} canVoid voided={false} />);
    expect(screen.queryByRole("button", { name: "Email a copy" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Void" })).toBeInTheDocument();
  });

  it("offers nothing once the receipt is void", () => {
    const { container } = render(<ReceiptActions {...props} canEmail canVoid voided />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
