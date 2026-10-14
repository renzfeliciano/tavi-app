import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MARKETS } from "@/config/markets";
import { REGISTRATION_FIELDS } from "@/modules/organizations/client";
import { type RegistrationCopy, RegistrationForm } from "./registration-form";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("./actions", () => ({ saveRegistrationAction: vi.fn() }));

const config = MARKETS.PH.registration;
if (!config) throw new Error("PH has a registration");

const copy: RegistrationCopy = {
  authority: config.authority,
  taxpayerTypes: config.taxpayerTypes.map((t) => ({ ...t })),
  incomeTaxOptions: config.incomeTaxOptions.map((o) => ({ ...o })),
  office: { label: config.office.label, hint: config.office.hint, example: config.office.example },
  taxRegisteredOnLabel: config.taxRegisteredOnLabel,
  lineOfBusinessHint: config.lineOfBusinessHint,
  lineOfBusinessExample: config.lineOfBusinessExample,
  industryCode: { label: config.industryCode.label, hint: config.industryCode.hint, example: config.industryCode.example },
  authorities: config.nameRegistration.authorities.map((a) => ({ ...a })),
  scopes: config.nameRegistration.scopes.map((s) => ({ ...s })),
};

const empty = Object.fromEntries(REGISTRATION_FIELDS.map((field) => [field, ""])) as Record<(typeof REGISTRATION_FIELDS)[number], string>;

describe("the registration form's examples", () => {
  it("shows the market's own line of business while it is empty", () => {
    render(<RegistrationForm initial={empty} copy={copy} editable />);

    expect(screen.getByLabelText(/^Line of business/)).toHaveAttribute("placeholder", "e.g. Auto repair shop");
  });

  it("shows what a name registration number looks like once an authority is chosen", () => {
    render(<RegistrationForm initial={{ ...empty, nameRegistrationAuthority: "dti" }} copy={copy} editable />);

    expect(screen.getByLabelText(/^Business Name No\./)).toHaveAttribute("placeholder", "e.g. 1234567");
  });
});

describe("the registration form's save bar", () => {
  it("says changes are unsaved once a field is edited", () => {
    render(<RegistrationForm initial={empty} copy={copy} editable />);
    expect(screen.getByRole("status")).toHaveTextContent("No changes yet");
    fireEvent.change(screen.getByLabelText(/^Line of business/), { target: { value: "Auto repair" } });
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
  });

  it("has no save bar for a member who cannot edit", () => {
    render(<RegistrationForm initial={empty} copy={copy} editable={false} />);
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });
});
