import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ForgotPasswordForm } from "./forgot-password/forgot-password-form";
import { SignInForm } from "./sign-in/sign-in-form";
import { SignUpForm } from "./sign-up/sign-up-form";

// The examples in the empty fields are the same person as the home page's sample
// quotation (Renzo Feliciano Payod Repair Services), so a first-time visitor sees one story.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({ authClient: {} }));
vi.mock("@/components/auth-stage", () => ({ useAuthStage: () => ({ setStage: vi.fn(), stage: "idle" }) }));

const WORK_EMAIL = "e.g. renzofelicianopayod.repairservices@gmail.com";

describe("example text in the account forms", () => {
  it("asks for a name and a work email on sign-up with Renzo Feliciano Payod's own", () => {
    render(<SignUpForm />);

    expect(screen.getByLabelText("Your name")).toHaveAttribute("placeholder", "e.g. Renzo Feliciano Payod");
    expect(screen.getByLabelText("Work email")).toHaveAttribute("placeholder", WORK_EMAIL);
  });

  it("shows the same example email on sign-in", () => {
    render(<SignInForm />);

    expect(screen.getByLabelText(/email/i)).toHaveAttribute("placeholder", WORK_EMAIL);
  });

  it("shows the same example email when asking for a reset link", () => {
    render(<ForgotPasswordForm />);

    expect(screen.getByLabelText(/email/i)).toHaveAttribute("placeholder", WORK_EMAIL);
  });
});
