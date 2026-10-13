import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RegistrationForm } from "./registration-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("./actions", () => ({ saveRegistrationAction: vi.fn(), turnOffRegistrationAction: vi.fn() }));

describe("the invoice registration form's examples", () => {
  it("shows what the certificate number and the serial range look like while empty", () => {
    render(
      <RegistrationForm
        editable
        active={false}
        labels={{ number: "Acknowledgement Certificate or PTU number", numberHint: "Issued by your RDO.", date: "Date issued", seriesHint: "The serials your RDO approved." }}
        titles={["Invoice", "Service Invoice"]}
        statementName="billing statements"
        initial={{ number: "", issuedOn: "", seriesStart: "", seriesEnd: "", title: "Invoice" }}
      />,
    );

    expect(screen.getByLabelText("Acknowledgement Certificate or PTU number")).toHaveAttribute("placeholder", "e.g. 123456789");
    expect(screen.getByLabelText("First serial number")).toHaveAttribute("placeholder", "e.g. 1");
    expect(screen.getByLabelText("Last serial number")).toHaveAttribute("placeholder", "e.g. 5000");
  });
});
