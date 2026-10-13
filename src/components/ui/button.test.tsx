import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, buttonVariants } from "./button";

describe("Button pending state", () => {
  it("shows the pending label next to a spinner, never a spinner alone", () => {
    render(
      <Button pending pendingLabel="Sending…">
        Send quote
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Sending…" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("is disabled while pending to prevent double submits", () => {
    render(
      <Button pending pendingLabel="Saving…">
        Save
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("renders its normal label when not pending", () => {
    render(<Button pendingLabel="Saving…">Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button).toBeEnabled();
  });
});

// Links are styled as buttons with `buttonVariants()` on its own (an <a> can't be a
// <button>). The base style has `border-transparent` and the outline variant sets its
// own border colour; only a class merge keeps the second, and the <Button> component
// does that. Without it an outline link had no visible border while the outline
// button beside it had one ("Download PDF" next to "Copy link").
describe("buttonVariants used on a link", () => {
  it("gives an outline link its border colour, not a transparent one", () => {
    const classes = buttonVariants({ variant: "outline" }).split(" ");

    expect(classes).toContain("border-border-strong");
    expect(classes).not.toContain("border-transparent");
  });

  it("styles a link exactly as the Button component styles a button", () => {
    render(<Button variant="outline">Copy link</Button>);

    const button = screen.getByRole("button", { name: "Copy link" });
    for (const name of buttonVariants({ variant: "outline" }).split(" ")) expect(button).toHaveClass(name);
  });

  it("keeps the base border for variants that set none", () => {
    expect(buttonVariants({ variant: "default" }).split(" ")).toContain("border-transparent");
  });

  it("lets a class passed in win, as on the Button", () => {
    expect(buttonVariants({ variant: "outline", className: "w-full" }).split(" ")).toContain("w-full");
  });
});
