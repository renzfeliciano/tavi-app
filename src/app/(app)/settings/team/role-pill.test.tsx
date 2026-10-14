import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RolePill } from "./role-pill";

describe("RolePill", () => {
  it.each([
    ["owner", "Owner"],
    ["admin", "Admin"],
    ["member", "Member"],
  ] as const)("names the %s role in words", (role, label) => {
    render(<RolePill role={role} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("gives each role its own icon next to the words, so it isn't told by colour alone", () => {
    const shapes = (["owner", "admin", "member"] as const).map((role) => {
      const { container, unmount } = render(<RolePill role={role} />);
      const svg = container.querySelector("svg");
      const html = svg?.innerHTML ?? "";
      expect(svg).toHaveAttribute("aria-hidden", "true");
      unmount();
      return html;
    });
    expect(new Set(shapes).size).toBe(3);
  });

  it("is a pill in ink colours from the tokens", () => {
    const { container } = render(<RolePill role="owner" />);
    const pill = container.firstElementChild as HTMLElement;
    expect(pill.className).toContain("rounded-full");
    expect(pill.className).not.toMatch(/#[0-9a-f]{3,6}|gradient|animate-/);
  });
});
