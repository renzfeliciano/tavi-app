import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignInForm } from "./sign-in-form";

const signIn = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({ authClient: { signIn: { email: (...a: unknown[]) => signIn(...a) } } }));
vi.mock("@/components/auth-stage", () => ({ useAuthStage: () => ({ setStage: vi.fn(), stage: "idle" }) }));

describe("SignInForm errors", () => {
  beforeEach(() => signIn.mockReset());

  it("turns off the browser's own validation bubble", () => {
    const { container } = render(<SignInForm />);
    expect(container.querySelector("form")).toHaveAttribute("noValidate");
  });

  it("shows what is missing next to each field and does not call the server", () => {
    const { container } = render(<SignInForm />);
    fireEvent.submit(container.querySelector("form")!);

    const email = screen.getByRole("textbox", { name: "Email" });
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Enter your email.");
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Enter your password.");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("moves focus to the first field that needs fixing and announces the summary", () => {
    const { container } = render(<SignInForm />);
    fireEvent.submit(container.querySelector("form")!);

    expect(screen.getByRole("textbox", { name: "Email" })).toHaveFocus();
    expect(screen.getByText("Some details need fixing. Check the highlighted fields.")).toBeInTheDocument();
  });

  it("clears a field's error as soon as the person types in it", () => {
    const { container } = render(<SignInForm />);
    fireEvent.submit(container.querySelector("form")!);
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "j" } });

    expect(screen.getByRole("textbox", { name: "Email" })).not.toHaveAttribute("aria-invalid");
  });
});
