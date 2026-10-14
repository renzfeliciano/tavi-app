import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormSection } from "./form-section";
import { JumpLinks } from "./jump-links";

const links = [
  { id: "logo", label: "Logo" },
  { id: "details", label: "Business details" },
  { id: "address", label: "Contact and address" },
];

describe("JumpLinks", () => {
  it("lists each section as a link to its place on the page", () => {
    render(<JumpLinks links={links} />);
    const nav = screen.getByRole("navigation", { name: "On this page" });
    const items = within(nav).getAllByRole("link");
    expect(items.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Logo", "#logo"],
      ["Business details", "#details"],
      ["Contact and address", "#address"],
    ]);
  });

  it("is as tall as a fingertip on a touch screen, like every other control", () => {
    render(<JumpLinks links={links} />);
    for (const a of within(
      screen.getByRole("navigation", { name: "On this page" }),
    ).getAllByRole("link")) {
      expect(a.className).toContain("pointer-coarse:h-11");
    }
  });

  it("draws nothing for a page with fewer than three sections", () => {
    const { container } = render(<JumpLinks links={links.slice(0, 2)} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("FormSection ids", () => {
  it("carries the id a jump link points at, with room above it when scrolled to", () => {
    render(
      <FormSection id="details" title="Business details">
        <input aria-label="Name" />
      </FormSection>,
    );
    const section = screen.getByRole("region", { name: "Business details" });
    expect(section).toHaveAttribute("id", "details");
    expect(section.className).toContain("scroll-mt-");
  });
});
