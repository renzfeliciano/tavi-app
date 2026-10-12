import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CustomerPicture, PartPaymentPicture, RecycleBinPicture, ReportPicture, RevisionPicture, ScanToPayPicture } from "./rest-pictures";

// The six small pictures beside "And the rest of the job". They are decoration
// that moves by itself (home.css: no script, nothing but opacity and transform),
// so each one is drawn here as the frame it rests on when nothing moves, and
// every one stays hidden from screen readers, because the words beside it say
// the same thing.

const ALL = [
  ["part-payments", PartPaymentPicture],
  ["scan to pay", ScanToPayPicture],
  ["reports", ReportPicture],
  ["customers", CustomerPicture],
  ["revisions", RevisionPicture],
  ["recycle bin", RecycleBinPicture],
] as const;

describe("the pictures beside the rest of the job", () => {
  it.each(ALL)("draws the %s picture as decoration, on a light page like the paper it stands for", (_name, Picture) => {
    const { container } = render(<Picture />);

    const picture = container.firstElementChild!;
    expect(picture).toHaveAttribute("aria-hidden", "true");
    expect(picture).toHaveAttribute("data-theme", "light");
  });

  it("rests part-paid, the downpayment in and the rest to come", () => {
    const { container } = render(<PartPaymentPicture />);

    expect(container).toHaveTextContent("Partly paid");
    expect(container).toHaveTextContent("₱2,250.00");
  });

  it("holds the paid look beside it, for when the bar fills", () => {
    const { container } = render(<PartPaymentPicture />);

    expect(container).toHaveTextContent("Paid");
    expect(container).toHaveTextContent("₱4,500.00");
  });

  it("shows the payment code and the Paid it flashes when it is scanned", () => {
    const { container } = render(<ScanToPayPicture />);

    expect(container.querySelectorAll("[data-cell]").length).toBeGreaterThan(0);
    expect(container).toHaveTextContent("Paid");
  });

  it("shows a CSV and the bars that grow", () => {
    const { container } = render(<ReportPicture />);

    expect(container).toHaveTextContent("CSV");
    expect(container.querySelectorAll(".home-grow")).toHaveLength(5);
  });

  it("shows a saved customer and a price, the name typed in under a cover that slides away", () => {
    const { container } = render(<CustomerPicture />);

    expect(container).toHaveTextContent("Juan Dela Cruz");
    expect(container).toHaveTextContent("₱600.00");
    expect(container.querySelector(".home-cover")).not.toBeNull();
  });

  it("rests on the second revision, with the total it changed to, and holds the first beside it", () => {
    const { container } = render(<RevisionPicture />);

    expect(container).toHaveTextContent("Rev 2");
    expect(container).toHaveTextContent("₱4,800.00");
    expect(container).toHaveTextContent("Rev 1");
    expect(container).toHaveTextContent("₱4,500.00");
  });

  it("shows a deleted draft over the bin it waits in", () => {
    const { container } = render(<RecycleBinPicture />);

    expect(container).toHaveTextContent("Draft");
    expect(container.querySelector(".home-bin-doc")).not.toBeNull();
  });
});
