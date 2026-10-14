import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CertificateActions } from "./certificate-actions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../actions", () => ({ voidCertificateAction: vi.fn(), deleteCertificateAction: vi.fn() }));

const props = { certificateId: "c1", short: "2307", payorName: "Dela Cruz Trading", paymentCount: 1 };

describe("CertificateActions", () => {
  it("offers Edit and Void to someone who can do both", () => {
    render(<CertificateActions {...props} canEdit canVoid voided={false} />);

    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/payments/withholding/c1/edit");
    expect(screen.getByRole("button", { name: "Void" })).toBeInTheDocument();
  });

  it("offers only what the person may do", () => {
    const { rerender } = render(<CertificateActions {...props} canEdit canVoid={false} voided={false} />);
    expect(screen.getByRole("link", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Void" })).not.toBeInTheDocument();

    rerender(<CertificateActions {...props} canEdit={false} canVoid voided={false} />);
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Void" })).toBeInTheDocument();
  });

  it("offers nothing once the certificate is void", () => {
    render(<CertificateActions {...props} canEdit canVoid voided />);

    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Void" })).not.toBeInTheDocument();
  });

  it("offers Delete to the owner once the certificate is void, and not before", () => {
    const { rerender } = render(<CertificateActions {...props} canEdit canVoid canDelete voided={false} />);
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();

    rerender(<CertificateActions {...props} canEdit canVoid canDelete voided />);
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();

    rerender(<CertificateActions {...props} canEdit canVoid canDelete={false} voided />);
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });
});
