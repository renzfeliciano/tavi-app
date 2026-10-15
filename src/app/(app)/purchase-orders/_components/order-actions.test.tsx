import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrderActions } from "./order-actions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../actions", () => ({
  cancelPurchaseOrderAction: vi.fn(),
  receivePurchaseOrderAction: vi.fn(),
  emailPurchaseOrderAction: vi.fn(),
  deletePurchaseOrderDraftAction: vi.fn(),
}));

const props = {
  orderId: "o1",
  number: "PO-000007",
  supplierEmail: null,
  orderDate: "2026-10-01",
  today: "2026-10-10",
  emailExample: "maria@example.com",
  canWrite: true,
  canIssue: true,
};
const names = () => screen.queryAllByRole("button").map((b) => b.textContent);
const links = () => screen.queryAllByRole("link").map((l) => l.textContent);

describe("OrderActions", () => {
  it("offers Edit and Delete on a draft", () => {
    render(<OrderActions {...props} status="DRAFT" />);
    expect(links()).toEqual(["Edit"]);
    expect(names()).toEqual(["Delete draft"]);
  });

  it("offers Email, Mark received and Cancel on an issued order", () => {
    render(<OrderActions {...props} status="ISSUED" />);
    expect(names()).toEqual(["Email supplier", "Mark received", "Cancel order"]);
  });

  it("lets a received order be emailed again and nothing else", () => {
    render(<OrderActions {...props} status="RECEIVED" />);
    expect(names()).toEqual(["Email supplier"]);
  });

  it("offers nothing on a cancelled order", () => {
    const { container } = render(<OrderActions {...props} status="CANCELLED" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offers only what the person may do", () => {
    const { rerender } = render(<OrderActions {...props} status="DRAFT" canWrite={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<OrderActions {...props} status="ISSUED" canIssue={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
