import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

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
