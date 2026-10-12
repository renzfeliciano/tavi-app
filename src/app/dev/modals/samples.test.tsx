import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { isSampleId, SAMPLES } from "./sample-list";
import { SampleModal } from "./samples";

function open(id: (typeof SAMPLES)[number]["id"]) {
  render(<SampleModal id={id} open onOpenChange={() => undefined} />);
  return screen.getByRole("dialog");
}

describe("modal samples", () => {
  it.each(SAMPLES)("$id opens with the $mascot Stamp beside its buttons", ({ id, mascot }) => {
    const dialog = open(id);
    const stamp = dialog.querySelector('[data-slot="dialog-footer"] .mascot');
    expect(stamp).toHaveAttribute("data-expression", mascot);
    expect(dialog).toHaveAccessibleName();
    expect(dialog).toHaveAccessibleDescription();
  });

  it("marks only the delete sample as danger, with a destructive button", () => {
    const dangerous = SAMPLES.filter(({ id }) => {
      const { unmount } = render(<SampleModal id={id} open onOpenChange={() => undefined} />);
      const tone = screen.getByRole("dialog").getAttribute("data-tone");
      unmount();
      return tone === "danger";
    }).map(({ id }) => id);
    expect(dangerous).toEqual(["danger"]);
    open("danger");
    expect(screen.getByRole("button", { name: "Delete forever" })).toBeTruthy();
  });

  it("gives the idle warning no close button, only a way to stay", () => {
    open("idle");
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(screen.getByRole("button", { name: "Stay signed in" })).toBeTruthy();
  });

  it("scrolls the long sample's body only, with header and footer outside it", () => {
    const dialog = open("long");
    const body = dialog.querySelector('[data-slot="dialog-body"]') as HTMLElement;
    expect(body.querySelectorAll("li").length).toBeGreaterThan(10);
    expect(body.className).toContain("overflow-y-auto");
    expect(body.contains(screen.getByRole("button", { name: "Save rates" }))).toBe(false);
    expect(body.contains(screen.getByText("Tax rates"))).toBe(false);
  });

  it("knows its own ids", () => {
    expect(SAMPLES.every(({ id }) => isSampleId(id))).toBe(true);
    expect(isSampleId("nope")).toBe(false);
    expect(isSampleId(undefined)).toBe(false);
  });
});
