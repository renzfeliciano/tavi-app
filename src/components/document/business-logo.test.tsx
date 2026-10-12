import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BusinessLogo } from "./business-logo";

const logo = (width: number, height: number) => ({ src: "/logo.png", width, height });

describe("BusinessLogo", () => {
  it("draws a very wide logo no wider than the document box", () => {
    render(<BusinessLogo logo={logo(600, 40)} name="Santos Aircon" />);
    const img = screen.getByRole("img", { name: "Santos Aircon logo" });
    expect(img).toHaveAttribute("width", "192");
    expect(img).toHaveAttribute("height", "13");
    expect(img.className).toContain("max-w-full");
  });

  it("draws a very tall logo no taller than the document box", () => {
    render(<BusinessLogo logo={logo(40, 600)} name="Santos Aircon" />);
    const img = screen.getByRole("img", { name: "Santos Aircon logo" });
    expect(img).toHaveAttribute("height", "64");
    expect(img).toHaveAttribute("width", "4");
  });

  it("fits into a custom box", () => {
    render(<BusinessLogo logo={logo(300, 100)} name="Santos Aircon" box={{ width: 120, height: 40 }} />);
    const img = screen.getByRole("img", { name: "Santos Aircon logo" });
    expect(img).toHaveAttribute("width", "120");
    expect(img).toHaveAttribute("height", "40");
  });

  it("draws nothing when the stored size is not a picture", () => {
    const { container } = render(<BusinessLogo logo={logo(0, 0)} name="Santos Aircon" />);
    expect(container).toBeEmptyDOMElement();
  });
});
