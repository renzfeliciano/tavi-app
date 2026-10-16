import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignUpForm } from "./sign-up-form";

const signUp = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({ authClient: { signUp: { email: (...a: unknown[]) => signUp(...a) } } }));

describe("SignUpForm errors", () => {
  beforeEach(() => signUp.mockReset());

  it("turns off the browser's own validation bubble", () => {
    const { container } = render(<SignUpForm />);
    expect(container.querySelector("form")).toHaveAttribute("noValidate");
  });

  it("shows every problem at once, next to its field, and sends nothing", () => {
    const { container } = render(<SignUpForm />);
    fireEvent.submit(container.querySelector("form")!);

    expect(screen.getByRole("textbox", { name: "Your name" })).toHaveAccessibleDescription("Enter your name.");
    expect(screen.getByRole("textbox", { name: "Work email" })).toHaveAccessibleDescription("Enter your email.");
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Choose a password.");
    expect(screen.getByRole("checkbox")).toHaveAccessibleDescription(/Agree to the Terms of Service/);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("asks for a longer password instead of the browser's length bubble", () => {
    const { container } = render(<SignUpForm />);
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "short" } });
    fireEvent.submit(container.querySelector("form")!);

    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(/Use at least \d+ characters\./);
  });

  it("puts focus on the first field that needs fixing", () => {
    const { container } = render(<SignUpForm />);
    fireEvent.submit(container.querySelector("form")!);

    expect(screen.getByRole("textbox", { name: "Your name" })).toHaveFocus();
  });
});
