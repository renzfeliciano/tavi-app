import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CellSub, CellTitle } from "./list-cells";

describe("list cells", () => {
  it("set a row's main text and the quieter line under it, each on its own line and cut short, never wrapped", () => {
    render(
      <>
        <CellTitle>Juan Dela Cruz</CellTitle>
        <CellSub>Santos Aircon</CellSub>
      </>,
    );

    expect(screen.getByText("Juan Dela Cruz")).toHaveClass("block", "truncate", "font-medium");
    expect(screen.getByText("Santos Aircon")).toHaveClass("block", "truncate", "text-sm", "text-muted-foreground");
  });
});
