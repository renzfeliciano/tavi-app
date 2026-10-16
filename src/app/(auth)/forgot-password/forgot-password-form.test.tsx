import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordForm } from "./forgot-password-form";

const requestReset = vi.fn();
vi.mock("@/lib/auth-client", () => ({ authClient: { requestPasswordReset: (...a: unknown[]) => requestReset(...a) } }));

describe("ForgotPasswordForm errors", () => {
  beforeEach(() => requestReset.mockReset());

  it("asks for the email next to the field, without the browser bubble, and sends nothing", () => {
    const { container } = render(<ForgotPasswordForm />);
    expect(container.querySelector("form")).toHaveAttribute("noValidate");
    fireEvent.submit(container.querySelector("form")!);

    const email = screen.getByRole("textbox", { name: "Email" });
    expect(email).toHaveAccessibleDescription("Enter your email.");
    expect(email).toHaveFocus();
    expect(requestReset).not.toHaveBeenCalled();
  });

  it("says when what was typed isn't an email address", () => {
    const { container } = render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "juan@" } });
    fireEvent.submit(container.querySelector("form")!);

    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAccessibleDescription(/Enter a valid email/);
  });
});
