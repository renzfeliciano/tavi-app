import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type EditorLine, LineItemsEditor } from "./line-items-editor";

const line = (over: Partial<EditorLine> = {}): EditorLine => ({
  key: "a",
  description: "",
  quantity: "",
  unitLabel: "job",
  unitPrice: "",
  discountKind: "percent",
  discountValue: "",
  taxRateId: "",
  sourceKind: "",
  sourceId: "",
  ...over,
});

const render1 = (lines: EditorLine[]) =>
  render(
    <LineItemsEditor
      lines={lines}
      amounts={{}}
      currency="PHP"
      taxRates={[]}
      units={["job", "hour"]}
      example="Aircon deep cleaning"
      errors={{}}
      onChange={vi.fn()}
      onMove={vi.fn()}
      onRemove={vi.fn()}
      onTouch={vi.fn()}
    />,
  );

describe("LineItemsEditor examples", () => {
  it("shows an example of a quantity and a price on an empty line", () => {
    render1([line()]);

    expect(screen.getByLabelText("Qty")).toHaveAttribute("placeholder", "e.g. 1");
    expect(screen.getByLabelText("Price (PHP)")).toHaveAttribute("placeholder", "0.00");
  });

  it("shows what a percent discount and an amount discount look like", () => {
    const { unmount } = render1([line({ discountKind: "percent" })]);
    expect(screen.getByLabelText(/discount percent/)).toHaveAttribute("placeholder", "e.g. 10");
    unmount();

    render1([line({ discountKind: "amount" })]);
    expect(screen.getByLabelText(/discount in PHP/)).toHaveAttribute("placeholder", "0.00");
  });
});
