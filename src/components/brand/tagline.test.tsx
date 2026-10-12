import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { brand } from "@/config/brand";
import { Tagline } from "./tagline";

describe("Tagline", () => {
  it("reads as the brand's primary tagline, in one piece", () => {
    render(
      <p data-testid="line">
        <Tagline />
      </p>,
    );
    expect(screen.getByTestId("line")).toHaveTextContent(brand.taglines.primary);
  });

  it("sets only the last sentence in the brand colour, as the home page does", () => {
    render(
      <p data-testid="line">
        <Tagline />
      </p>,
    );
    const accent = screen.getByText("Get paid.");
    expect(accent).toHaveClass("text-primary-text");
    expect(screen.getByTestId("line").querySelectorAll(".text-primary-text")).toHaveLength(1);
    expect(screen.queryByText("Create. Send.")).not.toHaveClass("text-primary-text");
  });
});
