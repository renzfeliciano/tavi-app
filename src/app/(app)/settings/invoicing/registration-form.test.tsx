import { fireEvent, render, screen } from "@testing-library/react";
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

describe("the invoice registration form's save bar", () => {
  const form = (active: boolean) =>
    render(
      <RegistrationForm
        editable
        active={active}
        labels={{ number: "Acknowledgement Certificate or PTU number", numberHint: "Issued by your RDO.", date: "Date issued", seriesHint: "The serials your RDO approved." }}
        titles={["Invoice", "Service Invoice"]}
        statementName="billing statements"
        initial={{ number: "", issuedOn: "", seriesStart: "", seriesEnd: "", title: "Invoice" }}
      />,
    );

  it("starts quiet, then says changes are unsaved once a field is edited", () => {
    form(false);
    expect(screen.getByRole("status")).toHaveTextContent("No changes yet");
    fireEvent.change(screen.getByLabelText("First serial number"), { target: { value: "1" } });
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
  });

  it("keeps the turn-off action beside the save button only while invoice mode is on", () => {
    const { unmount } = form(false);
    expect(screen.queryByRole("button", { name: "Turn off invoice mode" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save and turn on invoice mode" })).toBeInTheDocument();
    unmount();
    form(true);
    expect(screen.getByRole("button", { name: "Turn off invoice mode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });
});
