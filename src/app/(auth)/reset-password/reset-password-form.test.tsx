import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResetPasswordForm } from "./reset-password-form";

const reset = vi.fn();
vi.mock("@/lib/auth-client", () => ({ authClient: { resetPassword: (...a: unknown[]) => reset(...a) } }));

describe("ResetPasswordForm errors", () => {
  beforeEach(() => reset.mockReset());

  it("asks for both passwords next to their fields and sends nothing", () => {
    const { container } = render(<ResetPasswordForm token="t" />);
    expect(container.querySelector("form")).toHaveAttribute("noValidate");
    fireEvent.submit(container.querySelector("form")!);

    expect(screen.getByLabelText("New password")).toHaveAccessibleDescription("Choose a new password.");
    expect(screen.getByLabelText("Type it again")).toHaveAccessibleDescription("Type the new password again.");
    expect(screen.getByLabelText("New password")).toHaveFocus();
    expect(reset).not.toHaveBeenCalled();
  });

  it("puts the mismatch on the second box instead of a banner", () => {
    const { container } = render(<ResetPasswordForm token="t" />);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "a-long-enough-password" } });
    fireEvent.change(screen.getByLabelText("Type it again"), { target: { value: "a-different-password!" } });
    fireEvent.submit(container.querySelector("form")!);

    expect(screen.getByLabelText("Type it again")).toHaveAccessibleDescription(/passwords don't match/);
    expect(reset).not.toHaveBeenCalled();
  });
});
