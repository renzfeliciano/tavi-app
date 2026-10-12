import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityFeed } from "./activity-feed";

// The activity card beside "And the rest of the job": the quotation approved, the
// billing statement sent, two payments in, and the statement paid, arriving one
// after another. It is drawn from the sample quotation's made-up figures, in the
// words of the app's own activity list, and plays by itself in CSS (home.css:
// opacity and transform only, and only for people who have not asked for less
// motion). Without motion it shows all of them. Decoration: the words beside it
// say the same thing.

const mount = () => render(<ActivityFeed quote="Quotation" invoice="Billing statement" />);

describe("ActivityFeed", () => {
  it("is decoration, on a light card like the app's own screens", () => {
    const { container } = mount();

    const card = container.firstElementChild!;
    expect(card).toHaveAttribute("aria-hidden", "true");
    expect(card).toHaveAttribute("data-theme", "light");
    expect(card).toHaveTextContent("Activity");
  });

  it("tells the story of one job, in the app's own words, with the sample's made-up figures", () => {
    const { container } = mount();

    expect(container).toHaveTextContent("Quotation QUO-000012 approved");
    expect(container).toHaveTextContent("Billing statement INV-000012 sent");
    expect(container).toHaveTextContent("Payment REC-000001 recorded on INV-000012");
    expect(container).toHaveTextContent("Payment REC-000002 recorded on INV-000012");
    expect(container.textContent?.match(/₱2,250\.00/g)).toHaveLength(2);
    expect(container).toHaveTextContent("Paid");
  });

  it("names the documents the way the market does", () => {
    const { container } = render(<ActivityFeed quote="Estimate" invoice="Invoice" />);

    expect(container).toHaveTextContent("Estimate QUO-000012 approved");
    expect(container).toHaveTextContent("Invoice INV-000012 sent");
  });

  it("lets each row arrive in its own turn", () => {
    const { container } = mount();

    const rows = [...container.querySelectorAll<HTMLElement>(".home-feed-row")];
    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.style.getPropertyValue("--i"))).toEqual(["0", "1", "2", "3", "4"]);
  });
});
