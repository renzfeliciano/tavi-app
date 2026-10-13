import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ForgotPasswordForm } from "./forgot-password/forgot-password-form";
import { ResetPasswordForm } from "./reset-password/reset-password-form";
import { SignInForm } from "./sign-in/sign-in-form";
import { SignUpForm } from "./sign-up/sign-up-form";

// A form with no method is sent as a GET when it is submitted before the page's
// script has loaded (a slow phone, a failed script), and the browser then puts the
// password in the web address: history, server logs, anything that logs addresses.
// A POST puts it in the body, which the page route ignores and answers with a clean form.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({ authClient: {} }));
vi.mock("@/components/auth-stage", () => ({ useAuthStage: () => ({ setStage: vi.fn(), stage: "idle" }) }));

describe("forms that take a password or an email", () => {
  it.each([
    ["sign-in", <SignInForm key="in" />],
    ["sign-up", <SignUpForm key="up" />],
    ["forgot-password", <ForgotPasswordForm key="forgot" />],
    ["reset-password", <ResetPasswordForm key="reset" token="t" />],
  ])("%s is sent as a POST if submitted before the script loads", (_name, form) => {
    const { container } = render(form);

    expect(container.querySelector("form")).toHaveAttribute("method", "post");
  });
});
