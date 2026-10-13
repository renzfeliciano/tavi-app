import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HistoryPicture, LetterheadPicture, LinkTravelPicture, PesoPicture, PhoneTapPicture, RolesPicture } from "./strength-pictures";

// The six small pictures in the violet band, one on each card. They play by
// themselves in CSS (home.css: opacity and transform only, looping, and only for
// people who have not asked for less motion), so each is drawn here as the frame
// it rests on when nothing moves. They sit on a light chip, like the paper and
// phones they stand for, so they read on the violet, and they are decoration:
// the words on the card say the same thing.

const ALL = [
  ["phone", PhoneTapPicture],
  ["link", LinkTravelPicture],
  ["letterhead", LetterheadPicture],
  ["history", HistoryPicture],
  ["pesos", PesoPicture],
  ["roles", RolesPicture],
] as const;

describe("the pictures in the violet band", () => {
  it.each(ALL)("draws the %s picture as decoration on a light chip", (_name, Picture) => {
    const { container } = render(<Picture />);

    const picture = container.firstElementChild!;
    expect(picture).toHaveAttribute("aria-hidden", "true");
    expect(picture).toHaveAttribute("data-theme", "light");
  });

  it("shows a phone with the quotation and the button a finger taps", () => {
    const { container } = render(<PhoneTapPicture />);

    expect(container).toHaveTextContent("Send");
    expect(container.querySelector(".home-tap-loop")).not.toBeNull();
  });

  it("shows a link travelling to a customer who approves it", () => {
    const { container } = render(<LinkTravelPicture />);

    expect(container.querySelector(".home-travel")).not.toBeNull();
    expect(container).toHaveTextContent("Approved");
  });

  it("shows the business's own name on its letterhead, typed in, with Tavi only a small line at the foot", () => {
    const { container } = render(<LetterheadPicture />);

    expect(container).toHaveTextContent("Renzo Feliciano Payod Repair Services");
    expect(container.querySelector(".home-cover")).not.toBeNull();
  });

  it("shows the four plain statuses a document goes through, ticked off in turn", () => {
    const { container } = render(<HistoryPicture />);

    for (const status of ["Draft", "Sent", "Approved", "Paid"]) expect(container).toHaveTextContent(status);
    expect(container.querySelectorAll(".home-tick")).toHaveLength(4);
  });

  it("shows pesos, VAT, a TIN and GCash, one after another", () => {
    const { container } = render(<PesoPicture />);

    for (const chip of ["₱ PHP", "VAT 12%", "TIN 000-000-000", "GCash"]) expect(container).toHaveTextContent(chip);
    expect(container.querySelectorAll(".home-cycle")).toHaveLength(4);
  });

  it("shows an owner, an admin and a member, each taking a turn", () => {
    const { container } = render(<RolesPicture />);

    for (const role of ["Owner", "Admin", "Member"]) expect(container).toHaveTextContent(role);
    expect(container.querySelectorAll(".home-cycle-3")).toHaveLength(6);
  });
});
