import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField } from "./form-field";

describe("FormField", () => {
  it("labels the control and describes it with the hint", () => {
    render(
      <FormField name="taxId" label="TIN" hint="Printed on your documents." optional>
        {(p) => <input {...p} />}
      </FormField>,
    );
    const input = screen.getByRole("textbox", { name: /TIN/ });
    expect(input).toHaveAttribute("name", "taxId");
    expect(input).toHaveAccessibleDescription("Printed on your documents.");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(screen.getByText("(optional)")).toBeInTheDocument();
  });

  it("replaces the hint with the error and marks the control invalid", () => {
    render(
      <FormField name="taxId" label="TIN" hint="Printed on your documents." error="Enter your TIN as digits.">
        {(p) => <input {...p} />}
      </FormField>,
    );
    const input = screen.getByRole("textbox", { name: "TIN" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter your TIN as digits.");
    expect(screen.queryByText("Printed on your documents.")).not.toBeInTheDocument();
  });

  it("takes an explicit id when a page repeats the same field", () => {
    render(
      <>
        <FormField name="prefix" id="prefix-quote" label="Prefix">
          {(p) => <input {...p} />}
        </FormField>
        <FormField name="prefix" id="prefix-invoice" label="Prefix">
          {(p) => <input {...p} />}
        </FormField>
      </>,
    );
    const ids = screen.getAllByRole("textbox", { name: "Prefix" }).map((el) => el.id);
    expect(ids).toEqual(["prefix-quote", "prefix-invoice"]);
  });
});
