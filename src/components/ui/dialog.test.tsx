import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";

function modal(props: { mascot?: Parameters<typeof DialogContent>[0]["mascot"]; tone?: "default" | "danger" } = {}) {
  render(
    <Dialog open>
      <DialogContent {...props}>
        <DialogHeader>
          <DialogTitle>Void payment?</DialogTitle>
          <DialogDescription>It stays on the record.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button>Keep it</Button>
          <Button variant="destructive">Void payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>,
  );
  const dialog = screen.getByRole("dialog");
  return { dialog, footer: dialog.querySelector('[data-slot="dialog-footer"]') as HTMLElement };
}

describe("Dialog with the Stamp", () => {
  it("sits in the footer beside the buttons, neutral unless the modal says otherwise", () => {
    const { footer } = modal();
    const stamp = footer.querySelector(".mascot");
    expect(stamp).not.toBeNull();
    expect(stamp).toHaveAttribute("data-expression", "neutral");
    expect(within(footer).getByRole("button", { name: "Void payment" })).toBeTruthy();
  });

  it("takes the face the modal asks for", () => {
    const { footer } = modal({ mascot: "concerned" });
    expect(footer.querySelector(".mascot")).toHaveAttribute("data-expression", "concerned");
  });

  it("is decoration: hidden from screen readers and out of the tab order", () => {
    const { footer } = modal({ mascot: "happy" });
    const stamp = footer.querySelector(".mascot") as SVGElement;
    expect(stamp).toHaveAttribute("aria-hidden", "true");
    expect(stamp.closest("[data-slot='dialog-mascot']")).toHaveAttribute("aria-hidden", "true");
    expect(stamp.querySelectorAll("a, button, [tabindex]")).toHaveLength(0);
  });

  it("can be left out (customer pages carry the business's branding)", () => {
    const { footer } = modal({ mascot: null });
    expect(footer.querySelector(".mascot")).toBeNull();
  });

  it("marks a destructive modal so it can be styled as one", () => {
    expect(modal({ tone: "danger" }).dialog).toHaveAttribute("data-tone", "danger");
  });

  it("is a bottom sheet on phones and a centred card from sm up", () => {
    const { dialog } = modal();
    expect(dialog.className).toContain("max-sm:bottom-0");
    expect(dialog.className).toContain("sm:max-w-sm");
  });
});

describe("a long modal", () => {
  function longModal() {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p>Lots of fields</p>
          </DialogBody>
          <DialogFooter>
            <Button>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    return {
      dialog,
      header: dialog.querySelector('[data-slot="dialog-header"]') as HTMLElement,
      body: dialog.querySelector('[data-slot="dialog-body"]') as HTMLElement,
      footer: dialog.querySelector('[data-slot="dialog-footer"]') as HTMLElement,
    };
  }

  it("keeps the header and footer in place and scrolls only the body", () => {
    const { dialog, header, body, footer } = longModal();
    expect(dialog.className).toContain("flex-col");
    expect(dialog.className).toContain("max-h-[92dvh]");
    expect(body.className).toContain("overflow-y-auto");
    expect(body.className).toContain("min-h-0");
    expect(header.className).toContain("shrink-0");
    expect(footer.className).toContain("shrink-0");
    expect(header.className).not.toContain("overflow");
    expect(footer.className).not.toContain("overflow");
  });

  it("lets a form wrapper sit in the layout without a box of its own", () => {
    const { dialog } = longModal();
    expect(dialog.className).toContain("[&>form]:contents");
  });
});
